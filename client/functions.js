const tmi = require("tmi.js");
const fs = require("fs");
const path = require("path");
const {dialog} = require('@electron/remote')
const say = require("say");

const url = "http://localhost:3333";
let client;
//let timingWords = JSON.parse(fs.readFileSync("timingWords.json", "utf-8"));
var datosLog;
document.title = "Twitch Bot";

/**
 * Función que hace una llamada al servidor para recibir el accessToken
 * @returns accessToken
 */
async function getAccessToken() {
    const response = await fetch(`${url}/refresh-token`);
    console.log("response -->", response);
    const data = await response.json();
    return data.access_token;
}

/**
 * Función que conecta con el chat de Twitch, para poder recibir mensajes.
 * @param {*} username 
 */
async function connectToTwitch(username) {
    const accessToken = await getAccessToken();
    const options = {
        identity: {
            username: username,
            password: `oauth:${accessToken}`
        },
        channels: [username]
    };

    client = new tmi.Client(options);
    console.log("Conectado con el cliente");

    client.on("message", onMessage)
    client.on("connected", onConnected);
    client.connect();
}

/**
 * Función que se activa cada vez que el client recibe un mensaje del chat de Twitch, los parámetros se pasan automáticamente
 * @param {*} channel 
 * @param {*} tags 
 * @param {*} message 
 * @param {*} self 
 * @returns Si el mensaje es del propio bot, no lo lee
 */
async function onMessage(channel, tags, message, self) {
    if (self) return;

    /*//Por cada mensaje, reduce counterWords por cada mensaje timeado
    timingWords.forEach(timer => {
        if (timer.countMessages > 0) {
            timer.countMessages--;
        }
    })*/

    //Si el mensaje empieza con el comando !timer
    if (message.startsWith("!timer")) {
        //Separa el mensaje por el primer espacio que haya y elimina el "!"
        const args = message.slice(1).split(" ");
        const command = args.shift();
        console.log("Comprobando timer");

        //Comprueba que el comando sea timer, que tenga mínimo un argumento y esté puesto por un administrador
        if (command === "timer" && (args.length > 0) && (tags.mod || (tags.badges && tags.badges.broadcaster))) {

            //Obtiene los minutos
            let minutes = parseInt(args[0]);

            if (isNaN(minutes) || minutes <= 0) {
                return;
            }

            client.say(channel, `⏳ Timer iniciado por ${minutes} minutos.`);

            let remainingTime = minutes;

            let timerInterval = setInterval(() => {
                remainingTime--;

                if (remainingTime > 0) {
                    client.say(channel, `⏳ Queda(n) ${remainingTime} minuto(s).`);

                } else {
                    clearInterval(timerInterval);
                    client.say(channel, `⏳ ¡Tiempo completado! ⏰`);

                }
            }, 60000); // 1 min

        }
        
    } else if(message.startsWith("!say")){ //Comprueba si el comando empieza por el comando !say
        //Esta función leerá el mensaje en voz alta junto con el nombre de usuario que lo ha enviado

        const args = message.slice(1).split(" ");
        const command = args.shift();
        if(command === "say" && (args.length > 0)){
            say.speak(`${tags.username} ha dicho: ${args.join(" ")}`);
        }

    }else { //En caso de no ser ninguno de estos dos, envía una llamada al servidor para que compruebe todos los comandos que no dependen directamente de estar en el cliente
        console.log("Comprobando comando");
        const response = await fetch(`${url}/chat-message`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                tags,
                message
            })
        });

        //Espera la respuesta del servidor
        const data = await response.json();
        if (data.punishment) { //Si recibe un castigo de vuelta, comprueba que tipo de castigo es y lo ejecuta
            if (data.punishment === "DELETE") {

                client.deletemessage(channel, tags.id).then(() => {
                    console.log(`Mensaje eliminado ${tags.id} del usuario @${tags.username}`)
                }).catch((err) => {
                    console.error(`Error al eliminar el mensaje ${tags.id} del usuario @${tags.username} -->`, err)
                });

            } else if (data.punishment === "TIMEOUT") {

                client.timeout(channel, tags.username, 60, "Uso de palabras prohibidas").then(() => {
                    client.say(channel, `@${tags.username}, ten cuidado con las palabras que utilizas.`);
                }).catch((err) => {
                    console.error(`Error aplicando timeout a @${tags.username} --> `, err)
                });

            } else if (data.punishment === "BAN") {

                client.ban(channel, tags.username, "Uso de palabras prohibidas").then(() => {
                    console.log(`@${tags.username} baneado`);
                }).catch((err) => {
                    console.error(`Error al banear a @${tags.username} -->`, err);
                });

            }

        } else if (data.response) { //Si no hay castigo, devuelve la respuesta del comando ejecutado por el servidor, en caso de que la haya
            client.say(channel, data.response);
        }
    }

};

function onConnected(addr, port) {
    console.log(`Bot conectado en ${addr} y ${port}`);

    /*//Reinicia todos los timers cuando se conecta por primera vez
    timingWords.forEach(timer => {

        if (timer.isActive) {
            timer.isActive = false;
            saveTimers();
        };
    });

    //Mensajes programados cada X segundos
    timingWords.forEach(timer => {
        setInterval(() => {
            if (!timer.isActive) {
                timer.isActive = true;
                saveTimers();

                //Crea un intervalo dentro del intervalo princiapl para comprobar cuantos mensajes se han enviado
                const interval = setInterval(() => {
                    if (timer.countMessages <= 0) {
                        client.say(datosLog.username, timer.message);
                        console.log(`Mensaje enviado: "${timer.message}"`);
                        timer.countMessages = timer.counter; //Reinicia la cuenta de mensajes
                        timer.isActive = false; //Cambia el booleano para ser capaz de recibir otro mensaje
                        saveTimers();
                        clearInterval(interval); //Termina el intervalo
                    } else {
                        console.log(
                            /*`Esperando más mensajes para: "${timer.message}". Mensajes restantes: ${timer.countMessages}`*/
                        /*);
                    }
                }, 1000); //Verifica el mensaje cada segundo
            } else {
                console.log(
                    `El temporizador de "${timer.message}" ya está activo.`
                );
            }
        }, timer.timer * 1000); //Tiempo del intervalo principal
    });*/
}

/**
 * Función para guardar en un json los timers de las palabras
 */
/*
function saveTimers() {
    fs.writeFileSync("timingWords.json", JSON.stringify(timingWords, null, 2));
    console.log("JSON actualizado con nuevos estados de temporizadores.");
}*/

// PARTE CLIENTE

//Para los tabs de las ventanas
window.onload = function () {
    let tabs = document.querySelectorAll(".tab-item");
    cargarComandos();
    tabs.forEach(tab => {
        tab.addEventListener("click", function () {
            //Le quitamos la clase active a todos los tabs
            tabs.forEach(t => t.classList = "tab-item");

            //Le ponemos active al tab seleccionado
            this.classList = "tab-item active"
        });
    });

    document.getElementById("usernameName").textContent = datosLog ? datosLog.username : "";

    let profile = document.getElementById("perfil");
    let logOut = document.getElementById("logOut");
    let botonLogOut = this.document.getElementById("logOutOculto");
    profile.addEventListener("click", function () {
        if (logOut.style.visibility === "hidden" || logOut.style.visibility === "") {
            logOut.style.visibility = "visible";
            logOut.style.pointerEvents = "auto";
        } else {
            logOut.style.visibility = "hidden";
            logOut.style.pointerEvents = "none";
        }
    })

    botonLogOut.addEventListener("click", function () {
        if (logOut.style.visibility === "hidden" || logOut.style.visibility === "") {
            logOut.style.visibility = "visible";
            logOut.style.pointerEvents = "auto";
        } else {
            logOut.style.visibility = "hidden";
            logOut.style.pointerEvents = "none";
        }
        cerrarSesion();
    });

    let botonLogIn = this.document.getElementById("loginButton");
    botonLogIn.addEventListener("click", function () {
        let username = document.getElementById("username").value.trim();
        let clientId = document.getElementById("clientId").value.trim();
        let secretKey = document.getElementById("secretKey").value.trim();
        let code = document.getElementById("code").value.trim();

        if (!username || !clientId || !secretKey || !code) {
            dialog.showErrorBox("Twitch Bot","Debes completar todos los campos para realizar el logIn");
            return;
        }

        datosLog = {
            username: username,
            clientId: clientId,
            secretKey: secretKey,
            code: code
        }

        fetch(`${url}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosLog)
        }).then(response => response.json())
            .then(data => {
                if (data == true) {
                    dialog.showMessageBox({
                        type: "info",
                        title: "Twitch Bot",
                        message: "Conectado al Bot!"
                    });
                    connectToTwitch(username);
                    document.getElementById("usernameName").textContent = datosLog.username;
                    document.getElementById("pantallaPrincipal").style.display = "none";
                } else {
                    dialog.showErrorBox("Twitch Bot", "Parece que alguno de tus datos no es correcto");
                    return;
                }
            })
    })

    var tabComandos = document.getElementById("commands");
    var tabPredictions = document.getElementById("predictions");
    var tabPolls = document.getElementById("polls");
    var tabWords = document.getElementById("words");
    var pantallaPrincipalInfo = document.getElementById("pantallaPrincipalInfo");

    tabComandos.addEventListener("click", function () {
        cargarComandos();
    })

    tabPredictions.addEventListener("click", function() {
        crearPredictions();
    })

    tabPolls.addEventListener("click", function() {
        crearPoll();
    })

    tabWords.addEventListener("click", function(){
        cargarWords();
    })
};

const tokenPath = path.join(__dirname, "../server/tokenData.json");
const loginPath = path.join(__dirname, "../server/loginData.json");

if (fs.existsSync(tokenPath)) {
    console.log("Conectando directamente a Twitch");
    datosLog = JSON.parse(fs.readFileSync(loginPath, "utf8"));
    connectToTwitch(datosLog.username);
    document.getElementById("usernameName").textContent = datosLog.username
    document.getElementById("pantallaPrincipal").style.display = "none";
} else {
    console.log("Login manual.");
}

function cerrarSesion() {
   
    dialog.showMessageBox({
        type: "info",
        title: "Twitch Bot",
        message: "Cerrando Sesion"
    });

     if (client) {
        client.disconnect().then(() => {
            console.log("Bot desconectado de Twitch.");
        }).catch((err) => {
            console.error("Error al desconectar el bot -->", err);
        });
    }

    if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        console.log("Archivo `tokenData.json` eliminado.");
    }

    if (fs.existsSync(loginPath)) {
        fs.unlinkSync(loginPath);
        console.log("Archivo `loginData.json` eliminado.");
    }

    document.getElementById("pantallaPrincipal").style.display = "block";
}

async function cargarComandos() {
    try {
            const response = await fetch(`${url}/getCommandsDB`);
            const commands = await response.json();
            pantallaPrincipalInfo.innerHTML = "";
            const table = document.createElement("table");
            table.classList.add("comandosTabla");

            table.innerHTML = `
            <tr>
                <th>Comando</th>
                <th>Respuesta</th>
            </tr>
        `;

            commands.forEach(com => {
                const row = document.createElement("tr");
                row.innerHTML = `
                <td>!${com.comando}</td>
                <td>${com.response}</td>
            `;
                table.appendChild(row);
            });

            pantallaPrincipalInfo.appendChild(table);

        }catch(err){
            console.error("Error al cargar comandos -->", err);
        }
}

function crearPredictions(){
    pantallaPrincipalInfo.innerHTML = "";
    pantallaPrincipalInfo.innerHTML = `
        <div id="crearPredicciones">
            <h2>Crear Predicción</h2>
            <input type="text" id="predictionTitle" placeholder="Título">
        
            <div id="optionsPred">
                <input type="text" class="optionInput" placeholder="Opción 1">
                <input type="text" class="optionInput" placeholder="Opción 2">
            </div>

            <button id="addOption">Agregar opción</button>

            <br>
            <button id="crearPrediccion">Crear Encuesta</button>
        </div>
    `;

    const options = document.getElementById("optionsPred");
    const addOption = document.getElementById("addOption");
    const crearPrediccion = document.getElementById("crearPrediccion");

    let optionCount = 2;

    addOption.addEventListener("click", () => {
        if (optionCount < 10) {
            optionCount++;

            const newInput = document.createElement("input");
            newInput.type = "text";
            newInput.classList.add("optionInput");
            newInput.placeholder = `Opción ${optionCount}`;

            options.appendChild(newInput);
        } else {
            dialog.showErrorBox("Twitch Bot", "No puedes agregar más de 10 opciones.");
        }
    });

    crearPrediccion.addEventListener("click", async function () {

        const title = document.getElementById("predictionTitle").value.trim();
        const duration = 60;
        const optionsInput = document.querySelectorAll(".optionInput");
        let optionsList = [];

        optionsInput.forEach(input => {
            if (input.value.trim() !== "") {
                optionsList.push(input.value.trim());
            }
        });

        if (title === "" || optionsList.length < 2) {
            dialog.showErrorBox("Twitch Bot", "Debes agregar un título o añadir mínimo 2 opciones.")
            return;
        }

        const opcionesMensaje = optionsList.join(" ");

        const mensajePred = {
            tags: { mod: true },
            message: `!createPred ${title} - ${opcionesMensaje} ${duration}`
        };

        try {
            const response = await fetch(`${url}/chat-message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(mensajePred)
            });

            const data = await response.json();
            
            dialog.showMessageBox({
                type: "info",
                title: "Twitch Bot",
                message: `Encuesta ${title} creada con éxito`
            });

            console.log("Encuesta enviada con éxito -->", data);

        } catch (err) {
            console.error("Error enviando la encuesta -->", err);
        }
    })
}

function crearPoll(){
pantallaPrincipalInfo.innerHTML = "";
    pantallaPrincipalInfo.innerHTML = `
        <div id="crearPolls">
            <h2>Crear Poll</h2>
            <input type="text" id="pollTitle" placeholder="Título">
        
            <div id="optionsPoll">
                <input type="text" class="optionInput" placeholder="Opción 1">
                <input type="text" class="optionInput" placeholder="Opción 2">
            </div>

            <button id="addOption">Agregar opción</button>

            <br>
            <button id="crearPoll">Crear Poll</button>
        </div>
    `;

    const options = document.getElementById("optionsPoll");
    const addOption = document.getElementById("addOption");
    const crearPoll = document.getElementById("crearPoll");

    let optionCount = 2;

    addOption.addEventListener("click", () => {
        if (optionCount < 5) {
            optionCount++;

            const newInput = document.createElement("input");
            newInput.type = "text";
            newInput.classList.add("optionInput");
            newInput.placeholder = `Opción ${optionCount}`;

            options.appendChild(newInput);
        } else {
            dialog.showErrorBox("Twitch Bot", "No puedes agregar más de 5 opciones.");
        }
    });

    crearPoll.addEventListener("click", async function () {

        const title = document.getElementById("pollTitle").value.trim();
        const duration = 60;
        const optionsInput = document.querySelectorAll(".optionInput");
        let optionsList = [];

        optionsInput.forEach(input => {
            if (input.value.trim() !== "") {
                optionsList.push(input.value.trim());
            }
        });

        if (title === "" || optionsList.length < 2) {
            dialog.showErrorBox("Twitch Bot", "Debes agregar un título o añadir mínimo 2 opciones.")
            return;
        }

        const opcionesMensaje = optionsList.join(" ");

        const mensajePred = {
            tags: { mod: true },
            message: `!createPoll ${title} - ${opcionesMensaje} ${duration}`
        };

        try {
            const response = await fetch(`${url}/chat-message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(mensajePred)
            });

            const data = await response.json();
            
            dialog.showMessageBox({
                type: "info",
                title: "Twitch Bot",
                message: `Poll ${title} creada con éxito`
            });

            console.log("Poll enviada con éxito -->", data);

        } catch (err) {
            console.error("Error enviando la poll -->", err);
        }
    })
}

async function cargarWords(){
    try {
        const response = await fetch(`${url}/getForbiddenWords`);
        const forbiddenWords = await response.json();
        pantallaPrincipalInfo.innerHTML = "";
        
        const table = document.createElement("table");
        table.classList.add("comandosTabla");

        table.innerHTML = `
            <tr>
                <th>Palabra</th>
                <th>Castigo</th>
            </tr>
        `;

        forbiddenWords.forEach(word => {
            const punishments = ["DELETE", "TIMEOUT", "BAN"];
            const punishmentText = punishments[word.punishment] || "DESCONOCIDO";

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${word.word}</td>
                <td>${punishmentText}</td>
            `;
            table.appendChild(row);
        });

        pantallaPrincipalInfo.appendChild(table);
        
    } catch (err) {
        console.error("Error al cargar palabras prohibidas --> ", err);
    }
}