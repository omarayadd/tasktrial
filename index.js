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
            const company = await Company.findById(admin.companyId).select('name');
            let token
            token = jwt.sign({ id: admin._id, role: admin.role,  companyId: admin.companyId }, 'companyAdmin-secret', { expiresIn: '1h' });
            return res.json({ token, role: admin.role,  companyId: admin.companyId, companyName: company ? company.name : null});
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


app.get('/getCompany/:id',companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    if(req.admin.role !== 'superAdmin'){
        res.status(404);
        throw new Error('Not Authorized');
    }
    const company = await Company.findById(req.params.id);
    if (!company) {
        res.status(404);
        throw new Error('Company not found');
    }
    if (company.logo) {
        company.logo = `${req.protocol}://${req.get('host')}/getLogo/${company.logo}`;        
    }
    if (company.cover) {
        company.cover = `${req.protocol}://${req.get('host')}/getCover/${company.cover}`;        
    }
    if (company.companyAdmin) {
        const admin = await Admin.findById(company.companyAdmin).select('email employeeLimit');
        if (admin) {
            // Add admin email and employee limit to the company object
            company._doc.admin_email = admin.email; // `_doc` is used to add non-schema fields in Mongoose
            company._doc.employeeLimit = admin.employeeLimit;
        }
    }


    res.status(200).json(company);
}));


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

    const company = await Company.findOne({ name: user.companyName });
    if (company && company.cover) {
        company.cover = `${req.protocol}://${req.get('host')}/getCover/${company.cover}`;
    } 

    const response = {
        user: user,
        companyCover: company ? company.cover : null
    };
    res.status(200).json(response);
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
    const usersWithCompanyId = await Promise.all(users.map(async (user) => {
        const userData = user.toJSON();

        // Adjust avatar URL
        if (userData.avatar) {
            if (userData.avatar === 'profile.png') {
                userData.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${userData.avatar}`;
            } else {
                userData.avatar = `${req.protocol}://${req.get('host')}/getImage/${userData.avatar}`;
            }
        }

        // Fetch company by name to get companyId
        const company = await Company.findOne({ name: user.companyName });
        userData.companyId = company ? company._id : null;

        return userData;
    }));


    res.status(200).json(usersWithCompanyId);
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
                    cover: 1,
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
            if (companyData.cover) {
                companyData.cover = `${req.protocol}://${req.get('host')}/getCover/${companyData.cover}`;
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
    const company = await Company.findOne({ name: companyName }).select('name');

    if (!company) {
        res.status(404);
        throw new Error('Company not found');
    }
    let users = await User.find({companyName: company.name});
    if (!users || users.length === 0) {
        res.status(404);
        throw new Error('No users found for the specified company');
    }
    users = users.map(user => {
        // Adjust avatar URL
        if (user.avatar) {
            if (user.avatar === 'profile.png') {
                user.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${user.avatar}`;
            } else {
                user.avatar = `${req.protocol}://${req.get('host')}/getImage/${user.avatar}`;
            }
        }
        return user;
    });
    if (company.cover) {
        company.cover = `${req.protocol}://${req.get('host')}/getCover/${company.cover}`;
    }

    // Create a response object that includes user details and company cover
    const response = {
        user: users,
        companyCover: company ? company.cover : null // Include company cover or null if not found
    };

    res.status(200).json(response); // Return user details
}));


app.get('/filterUsers', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    let users
    const { userName } = req.query;
    
    if (!userName) {
        res.status(400);
        throw new Error('Please provide a user name');
    }
    if(req.admin.role === 'superAdmin'){
        users = await User.find({ 
            firstname: { 
                $regex: userName, 
                $options: 'i' // 'i' for case-insensitive search
            }
        });
    }
    else {
        throw new Error('Not Authoraized');
    }
    
    
    if (!users) {
        res.status(400);
        throw new Error('User with this name not found');
    }

    const usersWithCompanyCover = await Promise.all(users.map(async (user) => {
        // Adjust avatar URL
        if (user.avatar) {
            if (user.avatar === 'profile.png') {
                user.avatar = `${req.protocol}://${req.get('host')}/uploads/images/${user.avatar}`;
            } else {
                user.avatar = `${req.protocol}://${req.get('host')}/getImage/${user.avatar}`;
            }
        }

        // Fetch the company associated with the user
        const company = await Company.findOne({ name: user.companyName });

        // Adjust company cover URL if it exists
        if (company && company.cover) {
            company.cover = `${req.protocol}://${req.get('host')}/getCover/${company.cover}`;
        }

        // Return user with company cover
        return {
            user,
            companyCover: company ? company.cover : null // Include company cover or null if not found
        };
    }));

    res.status(200).json(usersWithCompanyCover); // Return user details
}));


app.get('/filterCompanies', companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    let companies
    const { name } = req.query;
    
    if (!name) {
        res.status(400);
        throw new Error('Please provide a compamy name');
    }
    if(req.admin.role === 'superAdmin'){
        companies = await Company.find({ 
            name: { 
                $regex: name, 
                $options: 'i' // 'i' for case-insensitive search
            }
        });
    }
    else {
        throw new Error('Not Authoraized');
    }
    
    
    if (!companies) {
        res.status(400);
        throw new Error('User with this name not found');
    }

    companies = await Promise.all(companies.map(async company => {
        if (company.logo) {
            company.logo = `${req.protocol}://${req.get('host')}/getLogo/${company.logo}`;
        }

        if (company.cover) {
            company.cover = `${req.protocol}://${req.get('host')}/getCover/${company.cover}`;
        }

        if (company.companyAdmin) {
            const admin = await Admin.findById(company.companyAdmin).select('email employeeLimit');
            if (admin) {
                company = {
                    ...company.toObject(),
                    admin_email: admin.email,
                    employee_limit: admin.employeeLimit
                };
            }
        }

        return company;
    }));
    res.status(200).json(companies); // Return user details
}));






// app.post('/createCompanyAdmin',upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
//     if(req.admin.role !== 'superAdmin'){
//         throw new Error('Not Authorized');
//     }
//     const { email, password, companyName, employeeLimit } = req.body;

//     const company = await Company.create({ name: companyName});
//     if (req.files && req.files.logo && req.files.logo.length > 0) {
//         company.logo = req.files.logo[0].filename;
//     }
//     if (req.files && req.files.cover && req.files.cover.length > 0) {
//         company.cover = req.files.cover[0].filename;
//     }
//     // if (req.files && req.files.avatar && req.files.avatar.length > 0) {
//     //     userData.avatar = req.files.avatar[0].filename;
//     // }
//     const admin = await Admin.create({
//         email,
//         password,
//         role: 'Admin',
//         companyId: company._id,
//         employeeLimit: employeeLimit || 0,
//     });
//     company.companyAdmin = admin._id;
//     await company.save();

//     res.status(201).json({ admin, company });
// }));


app.post(
    '/createCompanyAdmin',
    upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
    companyAdminAuthMiddleware,
    asyncHandler(async (req, res) => {
        if (req.admin.role !== 'superAdmin') {
            res.status(403);
            throw new Error('Not Authorized');
        }

        const { email, password, companyName, employeeLimit } = req.body;

        // Validate required fields
        if (!email || !password || !companyName) {
            res.status(400);
            throw new Error('Missing required fields: email, password, or companyName');
        }

        // Initialize company data
        const companyData = { name: companyName };

        // Add logo and cover if present
        if (req.files) {
            if (req.files.logo && req.files.logo.length > 0) {
                companyData.logo = req.files.logo[0].filename;
            }
            if (req.files.cover && req.files.cover.length > 0) {
                companyData.cover = req.files.cover[0].filename;
            }
        }

        // Create company and admin in parallel
        const [company, admin] = await Promise.all([
            Company.create(companyData),
            Admin.create({
                email,
                password,
                role: 'Admin',
                employeeLimit: employeeLimit || 0,
            }),
        ]);

        // Link admin to company
        company.companyAdmin = admin._id;
        await company.save();

        // Return relevant data
        res.status(201).json({
            company: {
                id: company._id,
                name: company.name,
                logo: company.logo,
                cover: company.cover,
            },
            admin: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
            },
        });
    })
);



app.post('/setUser', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), companyAdminAuthMiddleware, asyncHandler(async (req, res) => {
    console.log('ahahhahahha1');
    try {
        const { firstname, email, phone, position, password, companyName } = req.body;

        if (!firstname || !email || !phone || !position || !password || !companyName) {
            res.status(400);
            throw new Error('Please fill in the required fields');
        }
        console.log('ahahhahahha2');
        const phoneRegex = /^\d+$/;
        if (!phoneRegex.test(phone)) {
            res.status(400);
            throw new Error('Phone number should only contain digits');
        }
        console.log('ahahhahahha3');
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400);
            throw new Error('Email already exists');
        }
        console.log('ahahhahahha4');
        let companyID = req.admin.companyId
        console.log(companyID)
        let companyy = await Company.findOne({ _id:new  mongoose.Types.ObjectId(companyID) });
        console.log(companyy);
        if ((companyy && (req.admin.role === 'Admin' || req.admin.role ==='superAdmin') && req.body.companyName === companyy.name)) {
            const companyAdmin = await Admin.findById(req.admin.id);

            if (0 >= companyAdmin.employeeLimit) {
                return res.status(400).json({ message: 'Employee limit reached for your company' });
            }
        }
        else if(req.admin.role!=='superAdmin'){
            throw new Error('Cannot add employee in this company');
        }
        console.log('ahahhahahha6');
        let userData = {
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            phone: req.body.phone,
            email: req.body.email,
            password: req.body.password,
            address: req.body.address,
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
        console.log('ahahhahahha6');
        if (req.files && req.files.avatar && req.files.avatar.length > 0) {
            userData.avatar = req.files.avatar[0].filename;
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


app.put('/updateUser/:id', companyAdminAuthMiddleware, upload.single('avatar'), asyncHandler(async (req, res) => {
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

    Object.keys(req.body).forEach(async key => {
        if (req.body[key] !== undefined) {
            if (key === 'companyName') {
                // Check if the company exists
                const company = await Company.findOne({ name: req.body.companyName });
                if (company) {
                    user.companyName = req.body.companyName;
                    user.companyId = company._id;  // Optionally update the companyId too
                } else {
                    throw new Error('Company not found');
                }
            } else {
                user[key] = req.body[key];
            }
        }
    });

    // if (req.files && req.files.avatar && req.files.avatar.length > 0) {
    //     userData.avatar = req.files.avatar[0].filename;
    // }
    if (req.file) {
        user.avatar = req.file.filename;  // Save the new avatar filename
    }
    // Save the user, which will trigger the pre-save hook for password hashing if the password has been modified
    const updatedUserr = await user.save();
    // Adjust avatar URL before sending the response
    const updatedUserWithAvatarUrl = updatedUserr.toJSON();
        if (updatedUserWithAvatarUrl.avatar) {
            updatedUserWithAvatarUrl.avatar = `${req.protocol}://${req.get('host')}/uploads/avatars/${updatedUserWithAvatarUrl.avatar}`;
        }
    
    res.status(200).json(updatedUserWithAvatarUrl);
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

app.patch('/updateCompany/:id',upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), companyAdminAuthMiddleware, upload.single('logo'), asyncHandler(async (req, res) => {
    try {
        // Find the company
        const company = await Company.findById(req.params.id);
        console.log(company)
        const admin = await Admin.findOne({companyId : company._id.toString()})
        console.log(admin)
        // if(req.admin.role !== 'superAdmin'){
        //     throw new Error('Not Authorized');
        // }
        // Check if the admin trying to update is the admin of this company
        if (!company || (req.admin.role!== 'superAdmin' && company.companyAdmin.toString() !== req.admin._id.toString())) {
            return res.status(403).json({ message: 'Not Authorized to update this company' });
        }

        // Update company details (name, employee limit)
        const { name, employeeLimit, email} = req.body;

        if (name) {
            company.name = name;
        }

        if (admin && employeeLimit) {
            admin.employeeLimit = employeeLimit;
        }

        if (admin && email) {
            admin.email = email;
        }

        if (req.files && req.files.logo && req.files.logo.length > 0) {
            company.logo = req.files.logo[0].filename;
        }

        if (req.files && req.files.cover && req.files.cover.length > 0) {
            company.cover = req.files.cover[0].filename;
        }

        await company.save();
        if(admin){
        await admin.save();
        }
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



