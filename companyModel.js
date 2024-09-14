const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const companySchema = new mongoose.Schema({
    name: { type: String, unique: true,  required: true },
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    companyAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    logo : { type: String },
});

module.exports = mongoose.model('Company', companySchema);
