const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/comandosTw', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

//esquema
let comandosTwSchema = new mongoose.Schema({
    usuario: {
        type: String,
        required: true,
        unique: true,
        minlength: 1
    },
    puntos: {
        type: Number,
        default: 0
    },
    timeOuts: {
        type: Number,
        default: 0
    }

}, {timestamps: true});

//modelo
let Usuarios = mongoose.model('usuarios', comandosTwSchema);
module.exports={Usuarios, mongoose}