const tmi = require('tmi.js');

//Introduce your channel name
const username = "";
//Introduce your OAuth Token
const accessToken = "";

const opts = {
    identity: {
        username: username,
        password: `oauth:${accessToken}`
    },
    //Add your channel here
    channels: ['']
}

const client = new tmi.Client(opts);

client.on('message', onMessage);
client.on('connected', onConnected);

client.connect();


//Function for when the bot connects to return the address and the port
function onConnected(addr, port){
    console.log(`Bot conectado en ${addr} y ${port}`);
}

//Function for when it reads a message
function onMessage(channel, tags, message, self){
    //We need to check if it's a command by verifying it starts with the '!' character
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
        }
    }else if(args.length > 0){
        if(command === "prueba2"){
            client.say(channel, `@${tags.username}, tu mensaje ha sido: ${args.join(' ')}}`);
        }
    }
    
    
}