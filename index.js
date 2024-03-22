const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const User = require('./userModel');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream')
const multer = require('multer')
const crypto = require('crypto')
const conn = mongoose.createConnection(process.env.MONGO_URI);
const cors = require('cors')

const app = express();
app.use(cors())

app.use('/uploads', express.static(path.join(__dirname, './uploads')))

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`MongoDB connected`);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

connectDB()


let gfs = conn.once("open", () => {
  
    gfs = new mongoose.mongo.GridFSBucket(conn.db,{
        bucketName:"uploads"
    })
  });



const diskStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        let destinationFolder = '';
        if (file.mimetype.startsWith('image')) {
            destinationFolder = 'uploads/images';
        } else if (file.mimetype.startsWith('application/pdf')) {
            destinationFolder = 'uploads/files';
        } else {
            return cb(new Error('Unsupported file type'), false);
        }
        cb(null, destinationFolder);
    },
    filename: function(req, file, cb) {
        const ext = file.mimetype.split('/')[1];
        const fileName = `user-${Date.now()}.${ext}`;
        cb(null, fileName);
    }
});



const fileFilterImage = (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (imageTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File must be of type image (jpeg, png, gif)'), false);
    }
};

const fileFilterPDF = (req, file, cb) => {
    const pdfTypes = ['application/pdf'];
    if (pdfTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File must be of type PDF'), false);
    }
};

const upload = multer({
    storage: diskStorage,
    fileFilter: function(req, file, cb) {
        if (file.fieldname === 'avatar') {
            fileFilterImage(req, file, cb);
        } else if (file.fieldname === 'cover') {
            fileFilterPDF(req, file, cb);
        } else {
            cb(new Error('Invalid fieldname'), false);
        }
    }
});


app.get('/', (req, res) => {
    res.render('upload');
});


app.get('/getUser/:id', asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    if (user.avatar) {
        user.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${user.avatar}`;
    }
    if(user.cover){
        user.cover = `${req.protocol}://${req.get('host')}/uploads/files/${user.cover}`
    }
    res.status(200).json(user);
}));


app.post('/setUser',upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]) , asyncHandler(async (req, res) => {
    if (!req.body.name || !req.body.email || !req.body.phone || !req.body.position) {
        res.status(400);
        throw new Error("Please fill the missing data");
    }
    let userData;
        userData = {
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            position: req.body.position,
            companyName: req.body.companyName,
            website: req.body.website,
            workingHours: {
                start: req.body.start,
                end: req.body.end
            },
            languages: req.body.languages,
            facebook: req.body.facebook,
            instagram: req.body.instagram,
            xTwitter: req.body.xTwitter,
            linkedIn: req.body.linkedIn,
        };
        if (req.files.avatar && req.files.avatar.length > 0) {
            userData.avatar = req.files.avatar[0].filename;
        }
        if(req.files.cover && req.files.cover.length>0){
            userData.cover =  req.files.cover[0].filename;
        }
    const user = await User.create(userData);
    res.status(200).json(user);
}));

app.put('/updateUser/:id',asyncHandler(async(res, req)=>{
        const user = await User.findById(req.params.id)
        if(!user){
            res.status(404)
            throw new Error('User not found')
        }
        
        const updateFields = {};
        for (const [key, value] of Object.entries(req.body)) {
            if (value !== undefined) {
                updateFields[key] = value;
            }
        }
        
        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateFields, {new:true})
        
        res.status(200).json(updatedUser)
   
}))
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`app is listening on port ${port}`);
});