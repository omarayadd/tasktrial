const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const User = require('.//userModel');
const Admin = require('./adminModel');
const Grid = require('gridfs-stream');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const crypto = require('crypto');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());

app.use('/uploads', express.static(path.join(__dirname, './uploads')));
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

connectDB();

const conn = mongoose.createConnection(process.env.MONGO_URI);
let gfs = conn.once('open', () => {
    gfs = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
});

const fileFilterImage = (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
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

const url = process.env.MONGO_URI;
const mongoClient = new mongoose.mongo.MongoClient(url);
const storage = new GridFsStorage({
    url,
    file: (req, file) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            return {
                bucketName: 'photos',
                filename: `${Date.now()}_${file.originalname}`,
            };
        } else {
            return {
                bucketName: 'covers',
                filename: `${Date.now()}_${file.originalname}`,
            };
        }
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'avatar') {
            fileFilterImage(req, file, cb);
        } else if (file.fieldname === 'cover') {
            fileFilterPDF(req, file, cb);
        } else {
            cb(new Error('Invalid fieldname'), false);
        }
    }
});

const adminAuthMiddleware = (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, 'your-admin-secret-here');
        req.admin = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

const userAuthMiddleware = (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, 'your-user-secret-here');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(email)
    console.log(password)

    try {
        let admin = await Admin.findOne({ email });
        console.log(admin)
        if (admin) {
            const isMatch = await admin.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }
            const token = jwt.sign({ id: admin._id, role: admin.role }, 'your-admin-secret-here', { expiresIn: '1h' });
            return res.json({ token, role: admin.role });
        }

        let user = await User.findOne({ email });
        if (user) {
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            const token = jwt.sign({ id: user._id, role: user.role }, 'your-user-secret-here', { expiresIn: '1h' });
            return res.json({ token, role: user.role, id:user._id });
        }

        return res.status(401).json({ message: 'Invalid username or password' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/getImage/:filename', async (req, res) => {
    try {
        await mongoClient.connect();

        const database = mongoClient.db('userDataApp');
        const imageBucket = new mongoose.mongo.GridFSBucket(database, {
            bucketName: 'photos',
        });

        let downloadStream = imageBucket.openDownloadStreamByName(req.params.filename);

        downloadStream.on('data', function (data) {
            return res.status(200).write(data);
        });

        downloadStream.on('error', function () {
            return res.status(404).send({ error: 'Image not found' });
        });

        downloadStream.on('end', () => {
            return res.end();
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: 'Error Something went wrong',
            error,
        });
    }
});

app.get('/getCover/:filename', async (req, res) => {
    try {
        await mongoClient.connect();

        const database = mongoClient.db('userDataApp');
        const imageBucket = new mongoose.mongo.GridFSBucket(database, {
            bucketName: 'covers',
        });

        let downloadStream = imageBucket.openDownloadStreamByName(req.params.filename);

        downloadStream.on('data', function (data) {
            return res.status(200).write(data);
        });

        downloadStream.on('error', function () {
            return res.status(404).send({ error: 'File not found' });
        });

        downloadStream.on('end', () => {
            return res.end();
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: 'Error Something went wrong',
            error,
        });
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
        if (user.avatar === 'profile.png') {
            user.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${user.avatar}`;
        } else {
            user.avatar = `${req.protocol}://${req.get('host')}/getImage/${user.avatar}`;
        }
    }
    if (user.cover) {
        user.cover = `${req.protocol}://${req.get('host')}/getCover/${user.cover}`;
    }
    res.status(200).json(user);
}));

app.get('/allUsers', adminAuthMiddleware, asyncHandler(async (req, res) => {
    const users = await User.find();
    if (!users) {
        res.status(404);
        throw new Error('No Users are found');
    }
    const usersWithUrls = users.map(user => {
        const userData = user.toJSON();
        if (userData.avatar) {
            if (userData.avatar === 'profile.png') {
                userData.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${userData.avatar}`;
            } else {
                userData.avatar = `${req.protocol}://${req.get('host')}/getImage/${userData.avatar}`;
            }
        }
        if (userData.cover) {
            userData.cover = `${req.protocol}://${req.get('host')}/getCover/${userData.cover}`;
        }
        return userData;
    });

    res.status(200).json(usersWithUrls);
}));

app.post('/setUser', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), asyncHandler(async (req, res) => {
    try {
        if (!req.body.name || !req.body.email || !req.body.phone || !req.body.position || !req.body.password) {
            res.status(400);
            throw new Error('Please fill the missing data');
        }

        const phoneRegex = /^\d+$/;
        if (!phoneRegex.test(req.body.phone)) {
            res.status(400);
            throw new Error('Phone number should only contain digits');
        }

        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            res.status(400);
            throw new Error('Email already exists');
        }

        let userData = {
            name: req.body.name,
            phone: req.body.phone,
            email: req.body.email,
            password: req.body.password,
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
            role: "employee",
        };

        if (req.files.avatar && req.files.avatar.length > 0) {
            userData.avatar = req.files.avatar[0].filename;
        }
        if (req.files.cover && req.files.cover.length > 0) {
            userData.cover = req.files.cover[0].filename;
        }

        const user = await User.create(userData);
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}));

app.put('/updateUser/:id', asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const updateFields = {};
    for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined) {
            updateFields[key] = value;
        }
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    res.status(200).json(updatedUser);
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});


app.delete('/deleteAllUsers', asyncHandler(async (req, res) => {
    try {
        const result = await User.deleteMany({});
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No users found to delete' });
        }
        res.status(200).json({ message: `Deleted ${result.deletedCount} users` });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}));

app.delete('/deleteUser/:id', asyncHandler(async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}));
