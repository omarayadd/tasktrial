const mongoose = require('mongoose')


const workingHoursSchema = new mongoose.Schema({
    start: {
      type: String,
      default: ""
    },
    end: {
      type: String,
      default: ""
    }
  });

const userSchema = mongoose.Schema({
    name:{
        type: String,
       required:[true, 'Please add your name'],
        minlength: 2, 
        maxlength: 50 
    },
    phone:{
        type: [String],
       required:[true, 'Please add phone number']
    },
    email:{
        type: String,
       required: [true, 'Please add email'],
        unique: true
    },
    position:{
        type: String,
       required:[true, 'Please add a position']
    },
    companyName:{
        type: String,
        default:""
    },
    website: {
        type: String,
        validate: {
          validator: function(value) {
            return /^(ftp|http|https):\/\/[^ "]+$/.test(value);
          },
          message: props => `${props.value} is not a valid URL!`
        },
        // default: ""
      },
    workingHours: {
        type: workingHoursSchema,
      },
     
    languages: {
        type: [String],
        default: []
      },
    facebook:{
        type:String,
        validate: {
            validator: function(value) {
              return /^(ftp|http|https):\/\/[^ "]+$/.test(value);
            },
            message: props => `${props.value} is not a valid URL!`
          },
          // default: ""
    },
    instagram:{
        type:String,
        validate: {
            validator: function(value) {
              return /^(ftp|http|https):\/\/[^ "]+$/.test(value);
            },
            message: props => `${props.value} is not a valid URL!`
          },
        // default: ""  
    },
    xTwitter:{
        type:String,
        validate: {
            validator: function(value) {
              return /^(ftp|http|https):\/\/[^ "]+$/.test(value);
            },
            message: props => `${props.value} is not a valid URL!`
          },
        // default: ""
    },
    linkedIn:{
        type:String,
        validate: {
            validator: function(value) {
              return /^(ftp|http|https):\/\/[^ "]+$/.test(value);
            },
            message: props => `${props.value} is not a valid URL!`
          },
        // default: ""
    },
    avatar :{
      type: String,
      default : 'uploads/profile.png'
    }


},{
    timestamps: true,
}
)

module.exports = mongoose.model('User', userSchema)