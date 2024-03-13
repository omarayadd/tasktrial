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

const app = express();

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

// let gfs;

// mongoose.connection.once('open', () => {
//     gfs = Grid(mongoose.connection.db, mongoose.mongo)
//     gfs.collection('uploads')
// });

let gfs = conn.once("open", () => {
  
    gfs = new mongoose.mongo.GridFSBucket(conn.db,{
        bucketName:"uploads"
    })
  });

const storage = new GridFsStorage({
    url: process.env.MONGO_URI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo)
            })
        })
    }
})

const upload = multer({ storage })

app.get('/', (req, res) => {
    res.render('upload');
});

app.get('/files', (req, res) => {
    gfs.find().toArray((err, files) => {
        if (err) {
            return res.status(500).json({
                err: err.message
            });
        }
        if (!files || files.length === 0) {
            return res.status(404).json({
                err: "No files exist"
            });
        }
        return res.json(files);
    });
});

app.get('/files/:id', (req, res) => {
    // const fileId = req.params.id;
    // console.log(fileId)
   
        // const objectId =new mongoose.Types.ObjectId(fileId); 
        // console.log(gfs.files.findOne())
        gfs.find({ _id: req.params.id }).toArray((err, file) => {
            if (err) {
                return res.status(500).json({
                    err: err.message
                });
            }
            if (!file) {
                return res.status(404).json({
                    err: "File not found"
                });
            }
            const readStream = gfs.createReadStream({ _id: objectId });
            readStream.pipe(res);
        });
});

app.get('/getUser/:id',asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if(!user){
        res.status(400)
        throw new Error('User not found')
    }
    res.status(200).json(user)
}));


app.post('/setUser', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.body.name || !req.body.email || !req.body.phone || !req.body.position) {
        res.status(400);
        throw new Error("Please fill the missing data");
    }
    let userData;
    if (req.file) {
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
            profileImage: req.file.id
        };
    }
    else {
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
        }
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
