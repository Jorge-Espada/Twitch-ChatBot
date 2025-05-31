# Twitch Chatbot

Twitch chat bot project to being able to interact with your chat by using tmi.js and Twitch's API

### Remember to use npm install to get the nodes into your folder

Code is commented in Spanish, will be translated to English soon...

### To-Do List
- [X] Connect with chat with tmi.js
- [X] Connect with Twitch features using API
- [X] Creating accessToken with your credentials in case you dont have any accessToken yet.
- [X] Refreshing accessToken in case it has expired
- [X] Quick command reply
- [X] Quick command reply with arguments
- [X] Text-to-Speech messages
- [ ] Being able to program messages to be sent every X minutes (Coming soon... Works but you cant add your own messages yet)
- [X] Create and Cancel Prediction (only Admin)
- [X] Create and Cancel Poll (only Admin)
- [X] Create Clip (only Admin)
- [X] Ban words to being removed if the bot detects them
- [X] User bot timeout count per user, depending on it, the timeout will be a ban.
- [X] Viewer earning / spending points game with messages
- [X] Add your own commands with this bot
- [X] Creating an app with interface to use the bot
- [X] Making use of databases to control points from viewers and being able to use them
- [ ] Gatcha system with a JSON/List of characters to use viewer points (Coming Soon...)
- [X] !followage Command
- [X] !timer
- [X] !game
- [X] !title
- [ ] !commands (Coming Soon...) You can Check Commands section meanwhile
- [ ] More...

### Instructions
In this annex, the instructions for extracting codes and credentials to connect to the application will be provided. The first step is to access the following link using a Twitch account: 🔗 https://dev.twitch.tv/console

![alt text](82e108e7-8a5b-4196-b418-cd01b5a77c61.png)

Once inside, we will find ourselves on this tab. To proceed, click on the button in the upper right corner: “Register Your Application”.

![alt text](49427509-c94d-4215-9ad5-595f73adcef6.png)

Once inside, you must name the application, provide a redirect URL (if using this project, it should be http://localhost:3000), and select a category, which in this case will be “Chat Bot”. The Confidential Client option will remain enabled, and you can proceed by clicking the Create button after completing the CAPTCHA.

After creating the application, you must re-enter it by clicking the admin button, as shown in the first image. Here, at the bottom, you will find the Client ID and the Secret Key, which must be generated and copied. You must save both keys in a secure place to remember them later.

Once this is done, you must modify the following URL, replacing the client_id field with the one extracted earlier:

https://id.twitch.tv/oauth2/authorize
    ?response_type=token
    &client_id=<your_client_id> 
    &redirect_uri=http://localhost:3000
    &scope=channel%3Amanage%3Apolls+channel%3Aread%3Apolls
    &state=c3ab8aa609ea11e793ae92361f002671

In the &scope section, permissions can be added based on Twitch's documentation. For this project, the &scope is:

&scope=channel%3Amanage%3Apolls+channel%3Aread%3Apolls+chat%3Aread+chat%3Aedit+channel%3Amoderate+channel%3Amanage%3Apredictions+channel%3Aread%3Apredictions+clips%3Aedit+moderator%3Aread%3Afollowers+channel%3Amanage%3Abroadcast
These permissions grant access to the following functionalities:

- Poll management

- Prediction management

- Channel moderation

- Poll reading

- Prediction reading

- Chat editing and reading

- Clip editing (allows clip creation)

- Follower reading

- Broadcast management

By copying and pasting this link into the browser, Twitch will request permissions to grant everything specified in the link. Once inside, a page with an error will appear; however, this is expected, and you are in the correct place.

![alt text](57024059-677b-4842-8dde-167b71e34ac2.png)

In the search bar, you will see a different link than the one entered. In this link, at the beginning, there will be a section indicating a code.

This code is for one-time use, but it is needed to generate the access keys.

Once the three codes have been obtained (Client ID, Secret Key, and Authorization Code), you can start the server and the client, in this order respectively, and enter them in the login screen along with the channel name.

Once done, you will be able to access all the application's functions. If you disconnect to use another account (you can close and open the application without issues), the application will lose all information, and the user must generate another one-time-use code to generate new access tokens.

## Commands

#### Commands with arguments

!timer → Requires a time argument in minutes. It will start a countdown until it reaches 0, notifying every minute of the remaining time. Example usage: !timer 3 (Activates a 3-minute timer).

!say → Requires as arguments the phrase or message that the user wants the content creator to use. It will convert the text to speech so the streamer can hear it. Example usage: !say Hello, how are you? (Reads the phrase aloud for the creator).

!createPred → Creates a prediction with the specified title, options, and duration. The last argument is always considered as the duration; if it's a text, the default duration is 60 seconds. The title and options are separated by a -. This follows the same format as polls. Example usage: !createPred Test Title - option1 option2 option3 180 (Creates a prediction titled “Test Title” with the mentioned options and a duration of 180 seconds).

!createPoll → Creates a poll with the specified title, options, and duration. Functions the same way as the prediction command. Example usage: !createPoll Test Title - option1 option2 option3 180 (Creates a poll titled “Test Title” with the mentioned options and a duration of 180 seconds).

!followAge → This command can be used with or without arguments. If no arguments are given, it checks the user's own follow age. If another username is specified, it retrieves their follow information. Example usage: !followAge or !followAge pepe23 (Displays the number of days that a user has been following the creator’s channel).

!game → This command can be used with or without arguments. If used without arguments, it returns the current stream category. If used with arguments by a moderator or the creator, it changes the stream category to the specified one. Example usage: !game (Returns the current category) or !game Mario Bros (Changes the category to Mario Bros).

!title → Requires an argument. If used by a moderator or the creator, it changes the stream title to the mentioned one. Example usage: !title This is the new title (Changes the stream title to “This is the new title”).

!addCommand → Adds a custom command with the specified keyword and response. Only moderators or the creator can use this. The command name should be provided without the “!” prefix. Example usage: !addCommand test This is a test command. (Creates the command !test where the bot returns “This is a test command” in chat).

!remCommand → Only usable by moderators or the creator. Requires the name of the command to be deleted, provided without the “!” prefix. Example usage: !remCommand test (Deletes the command !test from the database).

!addWord → Only usable by moderators or the creator. Requires as arguments the word to be restricted and the punishment level:

0 → Deletes the message

1 → Temporarily isolates the user

2 → Bans the user from chat Example usage: !addWord forbiddenWord 0 (If the bot detects “forbiddenWord,” it deletes the message). Note: The bot cannot delete messages from moderators or the creator.

!remWord → Only usable by moderators or the creator. Takes the word to be removed as an argument and deletes it from the database, making it no longer moderated. Example usage: !remWord forbiddenWord

!roulette → The user bets a chosen amount of fictional points. Depending on luck, they either double their points or lose them. Example usage: !roulette 100 (Bets 100 points, winning 200 or losing them).

!addPoints → Only usable by moderators or the creator. Takes as arguments the username and the number of points to be added. Example usage: !addPoints Pepe23 150 (Adds 150 points to the user "Pepe23").

#### Commands without arguments

These commands activate simply by typing them:

!cancelPred → Checks if an active prediction exists and cancels it, refunding the invested points. These points are specific to Twitch and not related to the application.

!closePoll → Checks for an active poll and cancels/closes it.

!clip → If the user is an affiliate or partner, generates a clip of the last 30 or 60 seconds, as determined by Twitch’s API.

!points → Returns the number of points the requesting user has in the database.

Any other unrecognized command will be checked against the database for user-created custom commands. If none is found, no response is given.

#### Twitch API

https://dev.twitch.tv/docs/

#### tmi.js

https://tmijs.com/

### say (text-to-speech)

https://www.npmjs.com/package/say