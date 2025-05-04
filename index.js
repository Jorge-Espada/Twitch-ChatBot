const tmi = require('tmi.js');
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { create } = require('domain');
var tokenData;
var client;

//Introduce your Ids and code
const clientId = "";
const secretKey = "";
const code = "";

//Create tokens var
var accessToken = null;
var accessTokenExpire = null;
var refreshToken = null;

//Introduce your channel name
const username = "";


//We check if the user has its tokenData.json created.
//In case is your first time using this script, it will create the json with your data.
const initializeTokens = async () => {
    try{ //In case the json already exists
        const tokenFilePath = path.join(__dirname, "tokenData.json");
        tokenData = require(tokenFilePath);
    
        //We get the tokens from the JSON
        accessToken = tokenData.access_token;
        accessTokenExpire = tokenData.expires_in;
        refreshToken = tokenData.refresh_token;
    
    
    }catch(err){ //In case the JSON doesnt exists yet
        if(err.code === "MODULE_NOT_FOUND"){
            console.log("El archivo tokenData.json no existe");
            tokenData = null;

            try{
                const tokens = await getAuthTokens(); //Gets the tokens
                tokenData = tokens;
                tokenData.expires_in = Date.now() + (tokenData.expires_in * 1000); //Puts the expire date in a format which js will understand when its expired

                fs.writeFileSync("tokenData.json", JSON.stringify(tokenData, null, 2), "utf-8"); //Saves the data in a json
                console.log("JSON creado");
    
                //We get the tokens from the JSON
                accessToken = tokenData.access_token;
                accessTokenExpire = tokenData.expires_in;
                refreshToken = tokenData.refresh_token;
            } catch(err){
                console.error("Error al obtener los tokens: ", err.message)
                throw err;
            }
    
        }else{
            console.error("Error al cargar el archivo tokenData.json", err);
            throw err;
        }
    }
}

//Function to make a call to twitch API to get the access token, refresh token and expire date
const getAuthTokens = () => {
    return new Promise(async (resolve, reject) => {
        const urlencoded = new URLSearchParams();
        urlencoded.append("client_id", clientId);
        urlencoded.append("client_secret", secretKey);
        urlencoded.append("code", code);
        urlencoded.append("grant_type", "authorization_code");
        urlencoded.append("redirect_uri", "http://localhost:3000");
    
        try{
            const response = await fetch("https://id.twitch.tv/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: urlencoded,
                redirect: "follow",
            });

            console.log(response);
            if(!response.ok){
                throw new Error(`Error en la respuesta: ${response.statusText}`);
            }
            
            const data = await response.json();
            resolve(data); //returns the data in a json


        }catch(err){
            console.error("Error a la hora de obtener accessTokens: ", err);
            reject(err)
        }
    })

}


//async function to make an await call to api
const refreshTwitchToken = async () => {
    try{
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ //Method to use that Content-Type
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: secretKey,
            }),
        });
        
        if(!response.ok){
            throw new Error(`Error al refrescar el token: ${response.statusText}`);
        }

        const data = await response.json();

        tokenData.access_token = data.access_token; //Saving the new accessToken
        accessToken = data.access_token;
        console.log("New Token --> ", accessToken);
        tokenData.expires_in = Date.now() + (data.expires_in * 1000); //Time to the token to expire
        accessTokenExpire = Date.now() + (data.expires_in * 1000);
        console.log("New expire time -->", accessTokenExpire); 
        tokenData.refresh_token = data.refresh_token || tokenData.refresh_token; //Refresh if needed the new refresh token
        refreshToken = data.refresh_token;
        console.log("New refreshToken -->", refreshToken);

        fs.writeFileSync("tokenData.json", JSON.stringify(tokenData, null, 2), "utf-8");
        console.log("JSON actualizado");


    }catch(err){
        console.error(err.message);
    }
}

//Now we check if the access token we got is valid or not
const isAccessToken = () => {
    return accessToken && accessTokenExpire && Date.now() < accessTokenExpire;
}

//Now we check the accessToken and refresh it in case it has expired
const checkToken = async () => {
    try{
        if(!isAccessToken()){
            console.log("Actualizando access Token");
            await refreshTwitchToken();
        }else{
            console.log("AccessToken válido")
        }
    }catch(err){
        console.log(err);
    }
}

//This is made so the client is created with the new values instead of the original ones
const connectToAPI = async () =>{
    await checkToken();

    const opts = {
        identity: {
            username: username,
            password: `oauth:${accessToken}`
        },
        //Add your channel here
        channels: ['Zorukx']
    }
    
    client = new tmi.Client(opts);
    
    client.on('message', onMessage);
    client.on('connected', onConnected);
    
    client.connect();
}

//Call to start up the whole script
const main = async () => {
    try{
        await initializeTokens();
        console.log("Tokens inicializados correctamente");

        await connectToAPI();
    }catch(err){
        console.error("Error durante la conexión con la API: ", err);
    }
}

main();

/*
**********************************
END OF CONNECTING TO API SCRIPT
**********************************
*/

var bannedWords = ["patata", "brocoli"];
var timingWords = [
    {message: "hola", timer: 10, timerInicial: 10, counter: 5, countMessages:5, isActive: false},
    {message: "adios", timer: 20, timerInicial: 20, counter: 10, countMessages: 10, isActive: false},
    {message: "prueba", timer: 30, timerInicial: 30, counter: 15, countMessages: 15, isActive: false}
]

//Function for when the bot connects to return the address and the port
function onConnected(addr, port){
    console.log(`Bot conectado en ${addr} y ${port}`);
        //Programmed messages every X seconds
        timingWords.forEach(timer => {
            setInterval(() => {
                if (!timer.isActive) {
                    timer.isActive = true;
    
                    // Creates an interval inside of the main interval to check how many messages have been sent
                    const interval = setInterval(() => {
                        if (timer.countMessages <= 0) {
                            client.say(username, timer.message);
                            console.log(`Mensaje enviado: "${timer.message}"`);
                            timer.countMessages = timer.counter; // Resets message counter
                            timer.isActive = false; // Changes the boolean to be able to recieve another message.
                            clearInterval(interval); // Clears the interval
                        } else {
                            /*console.log(
                                `Esperando más mensajes para: "${timer.message}". Mensajes restantes: ${timer.countMessages}`
                            );*/
                        }
                    }, 1000); // Verifies messages every second
                } else {
                    console.log(
                        `El temporizador de "${timer.message}" ya está activo.`
                    );
                }
            }, timer.timer * 1000); // Main interval time
        });
}

//Function for when it reads a message
async function onMessage(channel, tags, message, self){
    //We need to check if it's a command by verifying it starts with the '!' character
    
    //If those messages are the own bot message, just ingore them
    if(self) return;
    //If its not, continue the code

    //For each message, reduce the counterWords of each timed message
    timingWords.forEach(timer =>{
        if(timer.countMessages > 0){
            timer.countMessages--;
        }
    })
    
    //Check banned words, if so, give a 60 seconds timeout to the user
    if(bannedWords.some(word => message.toLowerCase().includes(word.toLowerCase()))){
        //In case you just want to delete the message with those words, use this code
        client.deletemessage(channel,tags.id).then(() => {
            console.log(`Mensaje eliminado: ${tags.id} del usuario @${tags.username}`)
        }).catch((err) => {
            console.error(`Error al eliminar el mensaje: ${tags.id} del usuario @${tags.username}`)
        })


        /*//In case you want to timeout the user, use this code
        client.timeout(channel, tags.username, 60, "Uso de palabras prohibidas").then(() => {
            client.say(channel, `@${tags.username}, ten cuidado con las palabras que utilizas.`);
        }).catch((err) => {
            console.error(`Error aplicando timeout a @${tags.username}`, err)
        })
        */
        /* //In case you want to ban the user, use this code
        client.ban(channel, tags.username, "Uso de palabras prohibidas").then(() => {
            console.log(`@${tags.username} baneado`);
        }).catch((err) =>{
                console.error(`Error al banear a @${tags.username}`, err);
        })
        */
    }

    if(!message.startsWith('!')) return;

    //For the bot to respond through the chat
    //client.say(channel, 'Bot en funcionamiento');

    //We take all the args from the command the user is giving
    const args = message.slice(1).split(' ');
    //We save the first argument as the command itself
    const command = args.shift().toLowerCase();

    //If its just the command send this messages
    if(args.length === 0){
        if(command === "prueba"){

            client.say(channel, `@${tags.username}, el mensaje ha funcionado correctamente `)
            
        }else if(command === "cancelpred" && (tags.mod || (tags.badges && tags.badges.broadcaster))){

            const cancelPred = await cancelPrediction();
            if(cancelPred){
                client.say(channel, "Se ha cancelado la predicción");
            }
        }
        else if(command === "closepoll" && (tags.mod || (tags.badges && tags.badges.broadcaster))){

            const closePoll = await cancelPoll();
            if(closePoll){
                client.say(channel, "Se ha cerrado la encuesta")
            }

        }else if(command ==="clip" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
            const clipId = await createClip();

            if(clipId){
                client.say(channel, `Clip creado: https://clips.twitch.tv/${clipId}`);
            }else{
                client.say(channel, "Hubo un problema al intentar crear el clip");
            }

        }else if(command === "followage"){
            let followMessage = await getFollowAge(tags.username);
            client.say(channel, `@${tags.username} ${followMessage}`)

        }else if (command === "game") {
            // Obtain current game
            let currentGame = await getCurrentGame();
            client.say(channel, `El streamer está jugando: ${currentGame}`);
        }
    }else if(args.length > 0){
        if(command === "prueba2"){

            client.say(channel, `@${tags.username}, tu mensaje ha sido: ${args.join(' ')}`);

        }else if(command === "createpred" && (tags.mod || (tags.badges && tags.badges.broadcaster))){ //tags is to check if the command is done by a streamer or mod

            let title = args[0];
            let duration = parseInt(args.pop());
            let choices = args.slice(1,11)

            if(isNaN(duration) ||duration <= 59){
                duration = 60;
            }
            
            try{

                const prediction = await createPrediction(title, choices, duration);

                if(prediction && prediction != null){
                    client.say(channel, `La predicción ${title} se ha creado`);

                }else{
                    client.say(channel, "Ya hay una predicción activa")
                }

            }catch(err){
                console.error("No se ha podido crear la encuesta ", err)
            }

        }else if(command === "createpoll" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
            let title = args[0];
            let duration = parseInt(args.pop());
            let choices = args.slice(1, 6);

            if(isNaN(duration) ||duration <= 59){
                duration = 60;
            }

            try{
                const poll = await createPoll(title, choices, duration);
                if(poll){
                    client.say(channel, `Se ha creado la encuesta "${title}"`);
                }else{
                    client.say(channel, "Ya hay una encuesta creada")
                }
            }catch(err){
                console.error("error al crear la encuesta --> ", err);
            }

        }else if(command === "followage"){
            let followMessage = await getFollowAge(args[0]);
            client.say(channel, `@${tags.username}, @${args[0]} ${followMessage}`)

        }else if(command === "game" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
            await setGame(args.join(" "));
            client.say(channel, "Categoría Actualizada")

        }else if(command === "title" && (tags.mod || (tags.badges && tags.badges.broadcaster))){
            await setTitle(args.join(" "));
            client.say(channel, "Titulo actualizado")

        }else if (command === "timer" && (tags.mod || (tags.badges && tags.badges.broadcaster))) {
            
            //Obtain minutes
            let minutes = parseInt(args[0]);
        
            if (isNaN(minutes) || minutes <= 0) {
                return;
            }
        
            client.say(channel, `⏳ Temporizador iniciado por ${minutes} minutos.`);
        
            let remainingTime = minutes;
        
            let timerInterval = setInterval(() => {
                remainingTime--;
        
                if (remainingTime > 0) {
                    client.say(channel, `⏳ Quedan ${remainingTime} minuto(s).`);
                } else {
                    clearInterval(timerInterval);
                    client.say(channel, `⏳ ¡Tiempo completado! ⏰`);
                }
            }, 60000); // 1 min
        }
    }
    
}


//Checks if a predictions already exist, if not creates one
async function createPrediction(title, choices, duration) {
    let broadcasterId = await getBroadcasterId(username); 
    let predictionId = await getPredictionId(broadcasterId);
    if(!predictionId){
        const body = {
            broadcaster_id: broadcasterId,
            title: title,
            outcomes: choices.map(choice => ({ title: choice })),
            prediction_window: duration,
        }
    
        try{
            const responsePrediction = await fetch("https://api.twitch.tv/helix/predictions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Client-Id": clientId,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
    
            if(!responsePrediction.ok){
                throw new Error(`Error: ${responsePrediction.status} - ${responsePrediction.statusText}`)
            }
    
            const data = await responsePrediction.json();
            console.log("Data prediccion")
            return data;
        }catch(err){
            console.error("Error creando prediccion:", err)
        }
    }else{
        return null;
    }
    
}

//Checks if a prediction exist, if it does, it cancels it
async function cancelPrediction(){
    let broadcasterId = await getBroadcasterId(username); 
    let predictionId = await getPredictionId(broadcasterId);
    if(predictionId){
        const body = {
            broadcaster_id: broadcasterId,
            id: predictionId,
            status: "CANCELED"
        };
    
        try {
            const response = await fetch('https://api.twitch.tv/helix/predictions', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Client-Id': clientId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
    
            if (!response.ok) {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }
    
            const data = await response.json();
            console.log('Predicción cancelada');
            return data;
        } catch (err) {
            console.error('Error al cancelar la predicción:', err.message);
            throw err;
        }
    }else{
        return null;
    }
    
};

/*async function checkActivePrediction(broadcasterId){
    try{
        const responseCheckPred = await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId
            },
        });

        if(!responseCheckPred.ok){
            throw new Error(`Error: ${responseCheckPred.status} - ${responseCheckPred.statusText}`)
        }

        const data = await responseCheckPred.json();
        const activePrediction = data.data.find(prediction => prediction.status === "ACTIVE" || prediction.status === "LOCKED");
        if(activePrediction){
            console.log("Hay una prediccion activa");
            return true;
        }else{
            console.log("No hay una prediccion activa");
            return false;
        }
    }catch(err){
        console.error("Error al verificar si hay una encuesta activa")
        throw err;
    }
}*/

//Gets streamer ID
async function getBroadcasterId(username){
    try{
        const responseBroadcast = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "client-Id": clientId
            },
        });

        if(!responseBroadcast.ok){
            throw new Error(`Error: ${responseBroadcast.status} - ${responseBroadcast.statusText}`)
        }

        const data = await responseBroadcast.json();
        if(data.data.length > 0){
            const broadcasterId = data.data[0].id;
            console.log("Broadcaster Id --> ", broadcasterId);
            return broadcasterId;
        }else{
            console.log("Usuario no encontrado");
            return null;
        }
    }catch(err){
        console.error("Error al obtener el BroadcasterId: ", err)
    }
}

//Gets PredictionID to be able to cancel it
async function getPredictionId (broadcasterId) {

    try {
        const response = await fetch(`https://api.twitch.tv/helix/predictions?broadcaster_id=${broadcasterId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Client-Id': clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const activePrediction = data.data.find(prediction => prediction.status === 'ACTIVE' || prediction.status === 'LOCKED');

        if (activePrediction) {
            console.log('ID de la predicción activa:', activePrediction.id);
            return activePrediction.id;
        } else {
            console.log('No hay predicciones activas.');
            return null;
        }
    } catch (err) {
        console.error('Error al obtener el ID de la predicción:', err.message);
        throw err;
    }
};

//Checks if a poll exists, if not, creates one
async function createPoll(title, choices, duration){
    let broadcasterId = await getBroadcasterId(username)
    let pollId = await getActivePollId(broadcasterId)
    if(pollId){
        console.log("Ya hay una encuesta creada")
        return null;
    }

    const body = {
        broadcaster_id: broadcasterId,
        title: title,
        choices: choices.map(choice => ({title: choice})),
        duration: duration
    };

    try{
        const responsePoll = await fetch("https://api.twitch.tv/helix/polls", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if(!responsePoll.ok){
            throw new Error(`Error: ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json();
        console.log("Encuesta creada")
        return data;
    }catch(err){
        console.error("Error creando encuesta: ", err);
    }
}


//Checks if a poll already exist, if it does, close it
async function cancelPoll(){
    let broadcasterId = await getBroadcasterId(username);
    let pollId = await getActivePollId(broadcasterId)

    const body = {
        broadcaster_id: broadcasterId,
        id: pollId,
        status: "TERMINATED"
    };

    try{
        const responsePoll = await fetch("https://api.twitch.tv/helix/polls", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if(!responsePoll.ok){
            throw new Error(`Error: ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json()
        console.log("Encuesta cerrada");
        return data;
    }catch(err){
        console.error("Error al cerrar la encuesta -->", err)
    }
}

//Gets Poll ID and checks if there's an active poll
async function getActivePollId(broadcasterId){
    try{
        const responsePoll = await fetch(`https://api.twitch.tv/helix/polls?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId
            }
        })

        if(!responsePoll.ok){
            throw new Error(`Error: ${responsePoll.status} --> ${responsePoll.statusText}`);
        }

        const data = await responsePoll.json();
        const activePoll = data.data.find(poll => poll.status === "ACTIVE")
        if(activePoll){
            console.log("ID de la encuesta activa --> ", activePoll.id)
            return activePoll.id
        }else{
            console.log("No hay encuestas activas")
            return null;
        }
    }catch(err){
        console.error("Error al obtener la ID de la necuesta: ", err.message)
    }
}

//Create a clip from the last 30-60 seconds (Seconds chosen automatically)
async function createClip(){
    let broadcasterId = await getBroadcasterId(username);

    try{
        const responseClip = await fetch("https://api.twitch.tv/helix/clips", {
            method: "POST",
            headers:{
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId
            },
            body: JSON.stringify({broadcaster_id: broadcasterId})
        });

        if(!responseClip.ok){
            throw new Error(`Error: ${responsePrediction.status} - ${responsePrediction.statusText}`)
        }

        const data = await responseClip.json()
        console.log("Clip creado");
        return data.data[0].id
    }catch(err){
        console.error("Error al crear el clip:", err);
    }
}


//Gets (in Days) the followAge of a user
async function getFollowAge(user){
    let userId = await getUserId(user);
    let broadcasterId = await getBroadcasterId(username);

    try{
        const responseFollow = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
            }
        });

        if(!responseFollow.ok){
            throw new Error(`Error: ${responseFollow.status} - ${responseFollow.statusText}`)
        }

        const data = await responseFollow.json();
        console.log(userId)
        const follower = data.data.find(user => user.user_id === userId);
        console.log(follower)

        if(!follower){
            return "No sigues el canal";
        }

        let followDate = new Date(follower.followed_at);
        let today = new Date();
        let daysFollowed = Math.floor((today - followDate) / (1000 * 60 * 60 * 24));

        return `sigue el canal desde hace ${daysFollowed} días.`;
    }catch(err){
        console.error("Error al obtener el followAge:", err)
        return "Hubo un problema al obtener el followAge";
    }
}


//Gets User ID
async function getUserId(username) {
    try {
        const response = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
            },
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        if (data.data.length > 0) {
            return data.data[0].id;
        } else {
            console.log("Usuario no encontrado");
            return null;
        }
    } catch (err) {
        console.error("Error al obtener el User ID:", err);
        return null;
    }
}


//Gets current game
async function getCurrentGame() {
    let broadcasterId = await getBroadcasterId(username)

    try {
        const response = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
            },
        });

        if (!response.ok){
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        } 

        const data = await response.json();
        return data.data[0].game_name;
    } catch (err) {
        console.error("Error al obtener el juego actual:", err);
        return "Desconocido";
    }
}

//Sets a new category to the stream
async function setGame(gameName) {

    let broadcasterId = await getBroadcasterId(username);


    try {
        // Obtaining the ID from the game
        const gameResponse = await fetch(`https://api.twitch.tv/helix/games?name=${gameName}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
            },
        });

        if (!gameResponse.ok){
            throw new Error(`Error: ${gameResponse.status} - ${gameResponse.statusText}`);
        } 

        const gameData = await gameResponse.json();
        if (gameData.data.length === 0){
             return false;
        }

        let gameId = gameData.data[0].id;

        // Updates category of the stream
        const updateResponse = await fetch("https://api.twitch.tv/helix/channels", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ broadcaster_id: broadcasterId, game_id: gameId }),
        });

        if (!updateResponse.ok){
            throw new Error(`Error: ${updateResponse.status} - ${updateResponse.statusText}`);
        }

        return true;
    } catch (err) {
        console.error("Error al cambiar la categoría:", err);
        return false;
    }
}


//Sets a new title to the stream
async function setTitle(title) {

    let broadcasterId = await getBroadcasterId(username)

    try {
        const response = await fetch("https://api.twitch.tv/helix/channels", {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": clientId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                broadcaster_id: broadcasterId,
                title: title,
            }),
        });

        if (!response.ok){
            throw new Error(`Error: ${response.status} - ${response.statusText}`);
        }

        return true; 
    } catch (err) {
        console.error("Error al cambiar el título del stream:", err);
        return false;
    }
}


