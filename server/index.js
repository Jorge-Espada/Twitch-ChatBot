const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const bp = require("body-parser");
const model = require("./model");
const modelUsers = require("./modelUsers");
let Comandos = model.Comandos;
let Usuarios = modelUsers.Usuarios;
let mongoose = model.mongoose;
let mongooseUsers = modelUsers.mongoose;

const app = express();
app.use(bp.json());

let loginData = {};
let tokenData = {};

/**
 * Comprobamos si el usuario tiene tokenData.json creado
 * En el caso que sea tu primera vez usando este script, creará un json con tus datos
 */
async function initializeTokens() {
    try {
        const tokenFilePath = path.join(__dirname, "tokenData.json");
        const loginFilePath = path.join(__dirname, "loginData.json");
        //En caso de que el json ya exista
        if (fs.existsSync(tokenFilePath)) {
            tokenData = JSON.parse(fs.readFileSync(tokenFilePath, "utf-8"));
            loginData = JSON.parse(fs.readFileSync(loginFilePath, "utf-8"));
            console.log("Cargando datos de tokenData.json")

        } else { //En caso de que el JSON no exista aún
            tokenData = await getAuthTokens();
            tokenData.expires_in = Date.now() + tokenData.expires_in * 1000;
            fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData, null, 2));
            fs.writeFileSync(loginFilePath, JSON.stringify(loginData, null, 2));
            console.log("Creando tokenData.json");

        }
    } catch (err) {
        console.error("Error al inicializar los tokens --> ", err);
        throw err;
    }

};


/**
 * Funcion para hacer una llamada a la API de Twitch para obtener el token de acceso, de refresco y la fecha de expiración
 * @returns Respuesta de la API
 */
async function getAuthTokens() {
    try {
        const params = new URLSearchParams({
            client_id: loginData.clientId,
            client_secret: loginData.secretKey,
            code: loginData.code,
            grant_type: "authorization_code",
            redirect_uri: "http://localhost:3000"
        });

        const apiCall = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
        });

        //Comprobación de error para que el servidor no se cierre en caso de error.
        if (!apiCall.ok) {
            const errorData = await response.json();
            throw new Error(`Error ${response.status} --> ${errorData.message}`);
        }

        return apiCall.json();

    } catch (err) {
        console.error("Error al obtener los tokens de Twitch --> ", err);
        throw err;
    }
}

/**
 * POST de login para que el usuario pase sus credenciales a partir del servidor
 */
app.post("/login", async (req, res) => {
    const { username, clientId, secretKey, code } = req.body;

    if (!username || !clientId || !secretKey || !code) {
        return res.json(false);
    }

    loginData = {
        username: username,
        clientId: clientId,
        secretKey: secretKey,
        code: code
    }

    try {
        await initializeTokens();

        app.listen(3333, () => {
            console.log("Servidor conectado en http://localhost:3333");
        })

        res.json(true);

    } catch (err) {
        console.log("Error inicializando los tokens -->", err);
        res.json(false);
    }
})

/**
 * GET para hacer uso del token de refresco en caso de que el token esté caducado
 */
app.get("/refresh-token", async (req, res) => {
    try {

        if (Object.keys(loginData).length === 0 || Object.keys(tokenData).length === 0) {
            await initializeTokens();
        }

        if (Date.now() > tokenData.expires_in) {
            const params = new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: tokenData.refresh_token,
                client_id: loginData.clientId,
                client_secret: loginData.secretKey
            });

            const apiCall = await fetch("https://id.twitch.tv/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params
            });

            const data = await apiCall.json();
            tokenData = {
                ...tokenData,
                ...data,
                expires_in: Date.now() + data.expires_in * 1000
            };
            fs.writeFileSync(path.join(__dirname, "tokenData.json"), JSON.stringify(tokenData, null, 2));
        }

        res.send({ access_token: tokenData.access_token });

    } catch (err) {
        console.error("Error al refrescar el token --> ", err)
        res.status(500).send(err)
    }
})

/**
 * POST que se utiliza cada vez que se recibe un mensaje, primero comprueba si tiene alguna palabra prohibida y luego los comandos
 */
app.post("/chat-message", async (req, res) => {
    const { tags, message } = req.body;

    let forbiddenWords = JSON.parse(fs.readFileSync("forbiddenWords.json", "utf-8",));
    if (!(tags.mod || (tags.badges && tags.badges.broadcaster))) {
        for (let word of forbiddenWords) {
            if (message.toLowerCase().includes(word.word.toLowerCase())) {
                if (word.punishment == 0) {
                    responseMessage = "DELETE";

                } else if (word.punishment == 1) {

                    let user = await Usuarios.findOne({ usuario: tags.username });

                    if (!user) {
                        user = new Usuarios({ usuario: tags.username, puntos: 0, timeOuts: 1 });
                    } else {
                        user.timeOuts += 1;
                    }

                    await user.save();

                    responseMessage = user.timeOuts >= 3 ? "BAN" : "TIMEOUT";

                } else if (word.punishment == 2) {
                    responseMessage = "BAN";
                }
                return res.send({ punishment: responseMessage });
            }
        }
    }


    try {       

        //Añade puntos al usuario si el mensaje no es un comando
        if (!message.startsWith("!")) {
            await addPoints(tags.username);
            return;
        }

        const args = message.slice(1).split(" ");
        const command = args.shift();

        if (args.length === 0) {

            if (command === "cancelPred" && (tags.mod || (tags.badges && tags.badges.broadcaster))) { //tags.mod y badges comprueba si el comando está hecho por un moderador o el streamer

                const cancelPred = await cancelPrediction();
                if (cancelPred) {
                    responseMessage = "Se ha cancelado la predicción";
                    console.log("Prediccion cancelada");
                }


            } else if (command === "closePoll" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {

                const closePoll = await cancelPoll();
                if (closePoll) {
                    responseMessage = "Se ha cerrado la encuesta";
                    console.log("Encuesta cerrada");
                }

            } else if (command === "clip" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {

                const clipId = await createClip();

                if (clipId) {
                    responseMessage = `Clip creado: https://clips.twitch.tv/${clipId}`;

                } else {
                    responseMessage = "Hubo un problema al intentar crear el clip";
                }

            } else if (command === "followAge") {
                let followMessage = await getFollowAge(tags.username);
                responseMessage = `@${tags.username} ${followMessage}`;

            } else if (command === "game") {
                // Obtain current game
                let currentGame = await getCurrentGame();
                responseMessage = `/me está jugando: ${currentGame}`;

            } else if (command === "points") {
                let user = await Usuarios.findOne({usuario: tags.username});

                if(!user){
                    return;
                }else{
                    responseMessage = `@${tags.username}, tienes ${user.puntos} puntos 🎉.`;
                }

            }else {
               
                const comandosDB = await Comandos.findOne({comando: command});

                if(comandosDB){
                    responseMessage = comandosDB.response;
                }else{
                    return;
                }
            }


        } else {

            if (command === "createPred" && (tags.mod || (tags.badges && tags.badges.broadcaster))) { 

                let duration = parseInt(args.pop());
                let fullMsg = args.join(" ");
                const splitMsg = fullMsg.split(" - ");

                if (splitMsg.length < 2) {
                    console.error("Debes usar '-' para separar el título de las opciones.");
                    return;
                }

                let title = splitMsg[0].trim();
                let choices = splitMsg[1].trim().split(" ").slice(0, 10);

                if (choices.length < 2) {
                    console.error("Debes agregar al menos 2 opciones.");
                    return;
                }

                if (isNaN(duration) || duration <= 59) {
                    duration = 60;
                }

                try {

                    const prediction = await createPrediction(title, choices, duration);

                    if (prediction && prediction != null) {
                        responseMessage = `La predicción ${title} se ha creado`;

                    } else {
                        responseMessage = "Ya hay una predicción activa";
                    }

                } catch (err) {
                    console.error("No se ha podido crear la encuesta -->", err)
                }

            } else if (command === "createPoll" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {

                let duration = parseInt(args.pop());
                let fullMsg = args.join(" ");
                const splitMsg = fullMsg.split(" - ");

                if (splitMsg.length < 2) {
                    console.error("Debes usar '-' para separar el título de las opciones.");
                    return;
                }

                let title = splitMsg[0].trim();
                let choices = splitMsg[1].trim().split(" ").slice(0, 5);

                if (choices.length < 2) {
                    console.error("Debes agregar al menos 2 opciones.");
                    return;
                }

                if (isNaN(duration) || duration <= 59) {
                    duration = 60;
                }

                try {
                    const poll = await createPoll(title, choices, duration);
                    if (poll) {
                        responseMessage = `Se ha creado la encuesta "${title}"`;
                    } else {
                        responseMessage = "Ya hay una encuesta creada";
                    }
                } catch (err) {
                    console.error("error al crear la encuesta --> ", err);
                }

            } else if (command === "followAge") {

                let followMessage = await getFollowAge(args[0]);

                responseMessage = `@${tags.username}, @${args[0]} ${followMessage}`;

            } else if (command === "game" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {
                await setGame(args.join(" "));
                responseMessage = "Categoría Actualizada";

            } else if (command === "title" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {
                await setTitle(args.join(" "));
                responseMessage = "Titulo actualizado";

            } else if(command === "addCommand" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
                if(args[0].startsWith("!")){
                    return;
                }
                const newCommand = new Comandos({ comando: args[0], response: args.slice(1).join(" ") });
                await newCommand.save();
                responseMessage = `Comando !${args[0]} añadido`;

            } else if(command === "remCommand" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
                const comandoRem = args[0];
                try{
                    const resultado = await Comandos.findOneAndDelete({comando: comandoRem});

                    if(resultado){

                        console.log("Comando borrado");
                        responseMessage = `Comando !${args[0]} eliminado`;

                    }else{
                        console.log("No se ha podido borrar el comando");
                        return;
                    }
                }catch(err){
                    console.error("Error al eliminar comandos -->", err);
                }
            }else if(command === "addWord" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {
                let word = args[0];
                let punishment = parseInt(args[1]);

                addForbiddenWord(word, punishment);

                responseMessage = `${word} añadida con castigo ${punishment}`;

            }else if(command === "remWord" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {
                let word = args[0];

                removeForbiddenWord(word);
                responseMessage = `${word} eliminada`;

            }else if(command === "roulette") {
                
                let puntos = parseInt(args[0]);

                if (!isNaN(puntos) && puntos > 0) {
                    responseMessage = await useRoulette(tags.username, puntos);
                }else{
                    return;
                }

            }else if(command === "addPoints" (tags.mod || (tags.badges && tags.badges.broadcaster))) {
                
                let target = args[0].toLowerCase();
                let points = parseInt(args[1]);

                if(!isNaN(points) && points > 0 && target){
                     let result = await addPointsUser(target, points);
                     responseMessage = result;
                }else{
                    return;
                }

            }else{
                return;
            }
        }

        res.send({ response: responseMessage || null });

    } catch (err) {
        console.error("Error al leer mensaje --> ", err);
        res.send("Error leyendo mensaje");
    }
})

/**
 * Función para añadirle puntos en base de datos al usuario cada vez que se recibe un mensaje del mismo
 * @param {*} username 
 */
async function addPoints(username) {
    try{
        let user = await Usuarios.findOne({ usuario: username });

        if (!user) {
            user = new Usuarios({ usuario: username, puntos: 50 });
            await user.save();
            console.log(`${username} agregado con 50 punto.`);
        } else {
            user.puntos += 50;
            await user.save();
            console.log(`${username} actualizado, ahora tiene ${user.puntos} puntos.`);
        }
    } catch (error) {
        console.error("Error al manejar el usuario en la base de datos ", error);
    }
}

/**
 * Función para añadir los puntos indicados al usuario
 * @param {*} username 
 * @param {*} points 
 * @returns El mensaje para que el bot escriba por el chat
 */
async function addPointsUser(username, points) {

     try {
        let user = await Usuarios.findOne({ usuario: username });

        if (!user) {
            return `${username} no encontrado en la base de datos.`;
        }

        user.puntos += points;
        await user.save();

        return `@${username} ahora tiene ${user.puntos} puntos!`;
    } catch (err) {
        console.error("Error al actualizar los puntos -->", err);
        return "Error al actualizar los puntos.";
    }
    
}

/**
 * Función para cuando el usuario utilice la ruleta y haga un 50% de probabilidades de duplicarle o quitarle los puntos
 * @param {*} username 
 * @param {*} puntos 
 * @returns El mensaje para que el bot escriba por el chat
 */
async function useRoulette(username, puntos) {
    try {
        let user = await Usuarios.findOne({ usuario: username });

        if (!user) {
            console.error(`${username} no encontrado.`);
            return `@${username}, no estás registrado en la base de datos.`;
        }

        if (user.puntos < puntos) {
            return `@${username}, no tienes suficientes puntos para apostar ${puntos}.`;
        }

        let win = Math.random() < 0.5;

        if (win) {
            user.puntos += puntos;
            await user.save();
            return `🎉 @${username} ha ganado la ruleta y ahora tiene ${user.puntos} puntos!`;
        } else {
            user.puntos -= puntos;
            await user.save();
            return `💀 @${username} ha perdido en la ruleta y ahora tiene ${user.puntos} puntos...`;
        }

    } catch (err) {
        console.error("Error al procesar la ruleta:", err);
    }
}

/**
 * GET para obtener los comandos de la base de datos
 */
app.get("/getCommandsDB", async(req, res) => {
    try{
        const comandos = await Comandos.find();
        console.log(comandos)
        res.json(comandos);
    }catch (err){
        console.error("Error obteniendo comandos -->", err);
        res.status(500).json({ err: "Error al obtener comandos" });
    }
})

/**
 * GET para obtener las palabras prohibidas del json
 */
app.get("/getForbiddenWords", (req, res) => {
    try {
        const forbiddenWords = JSON.parse(fs.readFileSync("forbiddenWords.json", "utf-8"));
        res.json(forbiddenWords);
    } catch (err) {
        console.error("Error al leer forbiddenWords.json -->", err);
        res.status(500).json({ err: "Error al cargar las palabras prohibidas." });
    }
});

/**
 * Función para añadir una palabra como palabra prohibida
 * @param {*} word 
 * @param {*} punishment 
 * @returns
 */
function addForbiddenWord(word, punishment){
    try {

        if (!word || ![0, 1, 2].includes(punishment)) {
            console.error("word debe ser un texto y punishment debe ser 0, 1 o 2");
            return;
        }

        const forbiddenWords = JSON.parse(fs.readFileSync("forbiddenWords.json", "utf-8"));

        if (forbiddenWords.some(item => item.word === word)) {
            console.error(`${word} ya existe en la lista.`);
            return;
        }

        forbiddenWords.push({ word, punishment });

        fs.writeFileSync("forbiddenWords.json", JSON.stringify(forbiddenWords, null, 4), "utf-8");

        console.log(`${word} agregada con castigo ${punishment}`);
    } catch (err) {
        console.error("Error al modificar forbiddenWords.json -->", err);
    }
}

/**
 * Función para elimianr una palabra como palabra prohibida
 * @param {*} remWord 
 * @returns
 */
function removeForbiddenWord(remWord){
    try {
        const forbiddenWords = JSON.parse(fs.readFileSync("forbiddenWords.json", "utf-8"));

        const updatedWords = forbiddenWords.filter(word => word.word !== remWord);

        if (forbiddenWords.length === updatedWords.length) {
            console.error(`${remWord} no existe en la lista.`);
            return;
        }

        fs.writeFileSync("forbiddenWords.json", JSON.stringify(updatedWords, null, 4), "utf-8");

        console.log(`${remWord} eliminada correctamente.`);
    } catch (err) {
        console.error("Error al modificar forbiddenWords.json -->", err);
    }
}

app.listen(3333, () => {
    console.log("Servidor corriendo en http://localhost:3333")
});


/**
 * //Comprueba si una predicción ya existe, si no existe, crea una
 * @param {*} title 
 * @param {*} choices 
 * @param {*} duration 
 * @returns La predicción
 */
async function createPrediction(title, choices, duration) {
    let broadcasterId = await getBroadcasterId(loginData.username);
    let predictionId = await getPredictionId(broadcasterId);
    if (!predictionId) {
        const body = {
            broadcaster_id: broadcasterId,
            title: title,
            outcomes: choices.map(choice => ({ title: choice })),
            prediction_window: duration,
        }

        try {
            const responsePrediction = await fetch("https://api.twitch.tv/helix/predictions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${tokenData.access_token}`,
                    "Client-Id": loginData.clientId,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            //Comprueba que la llamada no da error para que no se cierre el servidor en caso de fallo
            if (!responsePrediction.ok) {
                throw new Error(`Error ${responsePrediction.status} --> ${responsePrediction.statusText}`)
            }

            const data = await responsePrediction.json();
            console.log("Data prediccion -->", data)
            return data;
        } catch (err) {
            console.error("Error creando prediccion -->", err)
        }
    } else {
        return null;
    }

}

/**
 * Comprueba si una predicción ya existe, si existe, la cancela
 */
async function cancelPrediction() {
    let broadcasterId = await getBroadcasterId(loginData.username);
    let predictionId = await getPredictionId(broadcasterId);
    if (predictionId) {
        const body = {
            broadcaster_id: broadcasterId,
            id: predictionId,
            status: "CANCELED"
        };

        try {
            const response = await fetch('https://api.twitch.tv/helix/predictions', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Client-Id': loginData.clientId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            //Comprueba que la llamada no da error para que no se cierre el servidor en caso de fallo
            if (!response.ok) {
                throw new Error(`Error ${response.status} --> ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Predicción cancelada');
            return data;
        } catch (err) {
            console.error('Error al cancelar la predicción -->', err);
            throw err;
        }
    } else {
        return null;
    }

};

/**
 * //Obtiene la ID del streamer
 * @param {*} username 
 * @returns la ID del streamer
 */

async function getBroadcasterId(username) {
    try {
        const responseBroadcast = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "client-Id": loginData.clientId
            },
        });

        if (!responseBroadcast.ok) {
            throw new Error(`Error ${responseBroadcast.status} --> ${responseBroadcast.statusText}`)
        }

        const data = await responseBroadcast.json();
        if (data.data.length > 0) {
            const broadcasterId = data.data[0].id;
            console.log("Broadcaster Id --> ", broadcasterId);
            return broadcasterId;
        } else {
            console.log("Usuario no encontrado");
            return null;
        }
    } catch (err) {
        console.error("Error al obtener el BroadcasterId --> ", err)
    }
}

/**
 * Obtiene la ID de la predicción
 * @param {*} broadcasterId 
 * @returns La ID de la predicción
 */
async function getPredictionId(broadcasterId) {

    try {
        const response = await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Client-Id': loginData.clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status} --> ${response.statusText}`);
        }

        const data = await response.json();
        const activePrediction = data.data.find(prediction => prediction.status === 'ACTIVE' || prediction.status === 'LOCKED');

        if (activePrediction) {
            console.log('ID de la predicción activa -->', activePrediction.id);
            return activePrediction.id;
        } else {
            console.log('No hay predicciones activas.');
            return null;
        }
    } catch (err) {
        console.error('Error al obtener el ID de la predicción -->', err.message);
        throw err;
    }
};

/**
 * Comrpueba que una encuesta existe, si no, crea una
 * @param {*} title 
 * @param {*} choices 
 * @param {*} duration 
 * @returns la encuesta
 */
async function createPoll(title, choices, duration) {
    let broadcasterId = await getBroadcasterId(loginData.username)
    let pollId = await getActivePollId(broadcasterId)
    if (pollId) {
        console.log("Ya hay una encuesta creada")
        return null;
    }

    const body = {
        broadcaster_id: broadcasterId,
        title: title,
        choices: choices.map(choice => ({ title: choice })),
        duration: duration
    };

    try {
        const responsePoll = await fetch("https://api.twitch.tv/helix/polls", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!responsePoll.ok) {
            throw new Error(`Error ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json();
        console.log("Encuesta creada")
        return data;
    } catch (err) {
        console.error("Error creando encuesta --> ", err);
    }
}


/**
 * Comprueba que existe alguna encuesta, si es así, la cancela
 * @returns 
 */
async function cancelPoll() {
    let broadcasterId = await getBroadcasterId(loginData.username);
    let pollId = await getActivePollId(broadcasterId)

    const body = {
        broadcaster_id: broadcasterId,
        id: pollId,
        status: "TERMINATED"
    };

    try {
        const responsePoll = await fetch("https://api.twitch.tv/helix/polls", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!responsePoll.ok) {
            throw new Error(`Error ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json()
        console.log("Encuesta cerrada");
        return data;
    } catch (err) {
        console.error("Error al cerrar la encuesta -->", err)
    }
}

/**
 * Comprueba si hay una encuesta activa, si es así, devuelve la ID de la encuesta
 * @param {*} broadcasterId 
 * @returns la ID de la encuesta
 */
async function getActivePollId(broadcasterId) {
    try {
        const responsePoll = await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId
            }
        })

        if (!responsePoll.ok) {
            throw new Error(`Error ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json();
        const activePoll = data.data.find(poll => poll.status === "ACTIVE")
        if (activePoll) {
            console.log("ID de la encuesta activa --> ", activePoll.id)
            return activePoll.id
        } else {
            console.log("No hay encuestas activas")
            return null;
        }
    } catch (err) {
        console.error("Error al obtener la ID de la necuesta --> ", err.message)
    }
}

/**
 * Crear un clip de los últimos 30-60 segundos (los segundos los elige automáticamente la API)
 * @returns la ID del clip 
 */
async function createClip() {
    let broadcasterId = await getBroadcasterId(loginData.username);

    try {
        const responseClip = await fetch("https://api.twitch.tv/helix/clips", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId
            },
            body: JSON.stringify({ broadcaster_id: broadcasterId })
        });

        if (!responseClip.ok) {
            throw new Error(`Error ${responsePrediction.status} --> ${responsePrediction.statusText}`)
        }

        const data = await responseClip.json()
        console.log("Clip creado");
        return data.data[0].id
    } catch (err) {
        console.error("Error al crear el clip -->", err);
    }
}

/**
 * Obtiene, en días, el tiempo que le sigue un usuario
 * @param {*} user 
 * @returns El mensaje que va a decir el bot por el chat
 */
async function getFollowAge(user) {
    let userId = await getUserId(user);
    let follower = await getAllFollowers(userId);

    try {

        if (!follower) {
            return "no sigue el canal";
        }

        let followDate = new Date(follower.followed_at);
        let today = new Date();
        let daysFollowed = Math.floor((today - followDate) / (1000 * 60 * 60 * 24));

        return `sigue el canal desde hace ${daysFollowed} días.`;
    } catch (err) {
        console.error("Error al obtener el followAge -->", err)
        return "Hubo un problema al obtener el followAge";
    }
}

/**
 * Obtiene con un bucle todos los seguidores del canal
 * @param {*} userId 
 * @returns el seguidor
 */
async function getAllFollowers(userId) {
    let broadcasterId = await getBroadcasterId(loginData.username);
    let cursor = null;

    try {
        do {
            let url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`;

            if (cursor) {
                url += `&after=${cursor}`;
            }

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${tokenData.access_token}`,
                    "Client-Id": loginData.clientId
                }
            });

            const data = await response.json();

            const follower = data.data.find(user => user.user_id === userId);
            if (follower) {
                console.log("Seguidor encontrado -->", follower);
                return follower;
            }

            cursor = data.pagination?.cursor;

        } while (cursor);

        console.log("El usuario no sigue el canal");
        return null;

    } catch (err) {
        console.error("Error al obtener todos los seguidores -->", err);
        return [];
    }
}


/**
 * Obtiene la ID del usuario
 * @param {*} username 
 * @returns la ID del usuario
 */
async function getUserId(username) {
    try {
        const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        if (data.data.length > 0) {
            return data.data[0].id;
        } else {
            console.log("Usuario no encontrado");
            return null;
        }
    } catch (err) {
        console.error("Error al obtener el User ID -->", err);
        return null;
    }
}


/**
 * Obtiene el juego actual
 * @returns 
 */
async function getCurrentGame() {
    let broadcasterId = await getBroadcasterId(loginData.username)

    try {
        const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status} --> ${response.statusText}`);
        }

        const data = await response.json();
        return data.data[0].game_name;
    } catch (err) {
        console.error("Error al obtener el juego actual -->", err);
        return "Desconocido";
    }
}

/**
 * Selecciona una nueva categoría para el directo
 * @param {*} gameName 
 * @returns true
 */
async function setGame(gameName) {

    let broadcasterId = await getBroadcasterId(loginData.username);

    try {
        //Obtiene el ID del juego o categoría
        const gameResponse = await fetch(`https://api.twitch.tv/helix/games?name=${gameName}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
            },
        });

        if (!gameResponse.ok) {
            throw new Error(`Error ${gameResponse.status} --> ${gameResponse.statusText}`);
        }

        const gameData = await gameResponse.json();
        if (gameData.data.length === 0) {
            return false;
        }

        let gameId = gameData.data[0].id;

        //Actualiza la categoría del directo
        const updateResponse = await fetch("https://api.twitch.tv/helix/channels", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ broadcaster_id: broadcasterId, game_id: gameId }),
        });

        if (!updateResponse.ok) {
            throw new Error(`Error ${updateResponse.status} --> ${updateResponse.statusText}`);
        }

        return true;
    } catch (err) {
        console.error("Error al cambiar la categoría -->", err);
        return false;
    }
}


/**
 * Actualiza el título del stream
 * @param {*} title 
 * @returns true
 */
async function setTitle(title) {

    let broadcasterId = await getBroadcasterId(loginData.username)

    try {
        const response = await fetch("https://api.twitch.tv/helix/channels", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${tokenData.access_token}`,
                "Client-Id": loginData.clientId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                broadcaster_id: broadcasterId,
                title: title,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status} --> ${response.statusText}`);
        }

        return true;
    } catch (err) {
        console.error("Error al cambiar el título del stream -->", err);
        return false;
    }
}