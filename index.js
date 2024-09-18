const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const User = require('.//userModel');
const Admin = require('./adminModel');
const Company = require('./companyModel')
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
        cb(new Error('Avatar must be of type image (jpeg, png, gif, webp)'), false);
    }
};


const url = process.env.MONGO_URI;
const mongoClient = new mongoose.mongo.MongoClient(url);

const storage = new GridFsStorage({
    url,
    file: (req, file) => {
        if (file.fieldname === 'avatar') {
            return {
                bucketName: 'photos',
                filename: `${Date.now()}_${file.originalname}`,
            };
        } else if (file.fieldname === 'cover') {
            return {
                bucketName: 'covers',
                filename: `${Date.now()}_${file.originalname}`,
            };
        }
        else if (file.fieldname === 'logo') {
            return {
                bucketName: 'logos',
                filename: `${Date.now()}_${file.originalname}`,
            };
        }
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'avatar' || file.fieldname==='logo' || file.fieldname ==='cover') {
            fileFilterImage(req, file, cb);
        }else {
            cb(new Error('Invalid fieldname'), false);
        }
    }
});

// const userAuthMiddleware = (req, res, next) => {
//     const token = req.header('Authorization').replace('Bearer ', '');

//     if (!token) {
//         return res.status(401).json({ message: 'No token, authorization denied' });
//     }

//     try {
//         const decoded = jwt.verify(token, 'your-user-secret-here');
//         req.user = decoded;
//         next();
//     } catch (err) {
//         res.status(401).json({ message: 'Token is not valid' });
//     }
// };


const companyAdminAuthMiddleware = (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, 'companyAdmin-secret');
        if (!decoded.role.includes('Admin')) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        req.admin = decoded;
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
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            let token
            token = jwt.sign({ id: admin._id, role: admin.role,  companyId: admin.companyId }, 'companyAdmin-secret', { expiresIn: '1h' });
            return res.json({ token, role: admin.role,  companyId: admin.companyId });
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

        return res.status(401).json({ message: 'Invalid email or password' });
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

app.get('/getLogo/:filename', async (req, res) => {
    try {
        await mongoClient.connect();

        const database = mongoClient.db('userDataApp');
        const imageBucket = new mongoose.mongo.GridFSBucket(database, {
            bucketName: 'logos',
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

app.get('/allUsers', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    let users
    if(req.admin.role === 'superAdmin'){
        users = await User.find();
    }
    else {
        const companyAdmin = await Admin.findById(req.admin.id);
        let companyy = await Company.findById(companyAdmin.companyId)
        companyName = companyy.name
        users = await User.find({ companyName: companyName});
    }
    
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


app.get('/allCompanies', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    let companies
    let companyWithUrls
    if(req.admin.role === 'superAdmin'){
        companies = await Company.aggregate([
            {
                $lookup: {
                    from: 'admins', // The name of the admin collection
                    localField: 'companyAdmin', // Field in the Company collection
                    foreignField: '_id', // Field in the Admin collection
                    as: 'adminDetails' // Alias for the joined data
                }
            },
            {
                $project: {
                    name: 1,
                    employees: 1,
                    logo: 1,
                    __v: 1,
                    'adminDetails.email': 1, // Keep only email from the admin details
                    'adminDetails.employeeLimit': 1 // Keep only employeeLimit from the admin details
                }
            }
        ]);

        companyWithUrls = companies.map(company => {
            const companyData = { ...company }; // Shallow copy of the company object
            if (companyData.logo) {
                companyData.logo = `${req.protocol}://${req.get('host')}/getLogo/${companyData.logo}`;
            }
            return companyData; // Return companyData even if there's no logo
        });
    } else {
        throw new Error('Not Authorized');
    }
    
    if (!companyWithUrls) {
        res.status(404);
        throw new Error('No comapnies are found');
    }

    res.status(200).json(companyWithUrls);
}));


app.delete('/deleteCompany/:id', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    console.log("saaaaaaaaaaaa")
    try {
        if (req.admin.role !== 'superAdmin') {
            return res.status(403).json({ message: 'Not Authorized' }); // 403 Forbidden for unauthorized access
        }

        const company = await Company.findByIdAndDelete(req.params.id);

        if (!company) {
            return res.status(404).json({ message: 'Company not found' }); // Return 404 if the company is not found
        }

        res.status(200).json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(500).json({ message: 'Server error', error: error.message }); // Send the error message
    }
}));

app.get('/companyUsers', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    
    if(req.admin.role === 'superAdmin'){
        comapnies = await Company.find().select('name');
    }
    else {
        throw new Error('Not Authoraized');
    }
    
    const { companyName } = req.query;
    
    if (!companyName) {
        res.status(400);
        throw new Error('Please provide a company name');
    }
    const company = await Company.findOne({ name: companyName }).select('_id');

    if (!company) {
        res.status(404);
        throw new Error('Company not found');
    }

    // Find users based on the provided company name
    const users = await User.find({ companyId: company });

    if (!users || users.length === 0) {
        res.status(404);
        throw new Error('No users found for the specified company');
    }

    res.status(200).json(users); // Return user details
}));


app.get('/filterUsers', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    let users
    const { userName } = req.query;
    
    if (!userName) {
        res.status(400);
        throw new Error('Please provide a user name');
    }
    console.log(userName)
    if(req.admin.role === 'superAdmin'){
        users = await User.find({ firstname: userName});
    }
    else {
        throw new Error('Not Authoraized');
    }
    
    
    if (!users) {
        res.status(400);
        throw new Error('User with this name not found');
    }

    res.status(200).json(users); // Return user details
}));




app.post('/createCompanyAdmin',upload.fields([{ name: 'logo', maxCount: 1 }]), companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    if(req.admin.role !== 'superAdmin'){
        throw new Error('Not Authorized');
    }
    const { email, password, companyName, employeeLimit } = req.body;

    const company = await Company.create({ name: companyName});
    if (req.files && req.files.logo && req.files.logo.length > 0) {
        company.logo = req.files.logo[0].filename;
    }
    // if (req.files && req.files.avatar && req.files.avatar.length > 0) {
    //     userData.avatar = req.files.avatar[0].filename;
    // }
    const admin = await Admin.create({
        email,
        password,
        role: 'Admin',
        companyId: company._id,
        employeeLimit: employeeLimit || 0,
    });
    company.companyAdmin = admin._id;
    await company.save();

    res.status(201).json({ admin, company });
}));



app.post('/setUser', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    try {
        const { firstname, email, phone, position, password, companyName } = req.body;

        if (!firstname || !email || !phone || !position || !password || !companyName) {
            res.status(400);
            throw new Error('Please fill in the required fields');
        }

        const phoneRegex = /^\d+$/;
        if (!phoneRegex.test(phone)) {
            res.status(400);
            throw new Error('Phone number should only contain digits');
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400);
            throw new Error('Email already exists');
        }

        let companyID = req.admin.companyId
        let companyy = await Company.findOne({ _id:new  mongoose.Types.ObjectId(companyID) });
        if (req.admin.role === 'Admin' && req.body.companyName === companyy.name) {
            const companyAdmin = await Admin.findById(req.admin.id);

            if (0 >= companyAdmin.employeeLimit) {
                return res.status(400).json({ message: 'Employee limit reached for your company' });
            }
        }
        else if(req.admin.role!=='superAdmin'){
            throw new Error('Cannot add employee in this company');
        }

        let userData = {
            firstname: req.body.firstname,
            lastname: req.body.lastname,
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
            companyId : req.admin.companyId
        };

        if (req.files && req.files.avatar && req.files.avatar.length > 0) {
            userData.avatar = req.files.avatar[0].filename;
        }
        if (req.files && req.files.cover && req.files.cover.length > 0) {
            userData.cover = req.files.cover[0].filename;
        }


        const user = await User.create(userData);


        let company = await Company.findOne({ name: companyName });
        if (!company) {
            company = new Company({
                name: companyName,
                companyAdmin: req.admin._id,
                employees: [user._id],
            });
        } else {
            company.employees.push(user._id);
        }

        await company.save();
        if (req.admin.role === companyName + 'Admin') {
            await Admin.findByIdAndUpdate(req.admin.id, {
                $inc: { employeeLimit: -1 }
            });
        }
        res.status(200).json({ user, company });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}));


app.put('/updateUser/:id', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (req.admin.role !== 'superAdmin') {
        if (user.companyId.toString() !== req.admin.companyId.toString()) {
            return res.status(403).json({ message: 'Unauthorized: You can only update employees of your own company' });
        }
    }
    const updateFields = {};
    for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined) {
            let company
            if (key === 'companyName'){
                // console.log("asasasas")
                company = await Company.find({name:value})
                if (company.length!==0){
                    updateFields[key] = value;
                }
                else{
                    throw new Error('Company not found');
                }
            }
            else{ 
            updateFields[key] = value;
            }
        }
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    res.status(200).json(updatedUser);
}));



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

app.patch('/updateCompany/:id',upload.fields([{ name: 'logo', maxCount: 1 }]), companyAdminAuthMiddleware, upload.single('logo'), asyncHandler(async (req, res) => {
    try {
        // Find the company
        const company = await Company.findById(req.params.id);
        // const admin = await Admin.findOne({companyId : company._id.toString()})

        if(req.admin.role !== 'superAdmin'){
            throw new Error('Not Authorized');
        }
        // Check if the admin trying to update is the admin of this company
        // if (!company || company.companyAdmin.toString() !== req.admin._id.toString()) {
        //     return res.status(403).json({ message: 'Not Authorized to update this company' });
        // }

        // Update company details (name, employee limit)
        const { name} = req.body;

        if (name) {
            company.name = name;
        }

        // if (employeeLimit) {
        //     admin.employeeLimit = employeeLimit;
        // }

        if (req.files && req.files.logo && req.files.logo.length > 0) {
            company.logo = req.files.logo[0].filename;
        }


        await company.save();
        // await admin.save();

        res.status(200).json({
            message: 'Company updated successfully',
            company
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}));

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});



