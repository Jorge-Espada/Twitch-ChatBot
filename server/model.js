const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/comandosTw', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

//esquema
let comandosTwSchema = new mongoose.Schema({
    comando: {
        type: String,
        required: true,
        unique: true,
        minlength: 1
    },
    response: {
        type: String,
        required: true,
        minlength: 1
    }
});

//modelo
let Comandos = mongoose.model('comandos', comandosTwSchema);
module.exports={Comandos, mongoose}