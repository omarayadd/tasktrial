const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // name: { type: String, required: true },
    firstname: {type: String, required: true },
    lastname: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    position: { type: String, required: true },
    companyName: { type: String },
    website: { type: String },
    workingHours: {
        start: { type: String },
        end: { type: String }
    },
    languages: [String],
    facebook: { type: String },
    instagram: { type: String },
    xTwitter: { type: String },
    linkedIn: { type: String },
    avatar: { type: String },
    cover: { type: String },
    role: {type:String, default: 'employee'},
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
