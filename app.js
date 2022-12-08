require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const {
    auth,
    requiresAuth
} = require('express-openid-connect');
const {
    query
} = require('express');
const querystring = require('querystring');
const Razorpay = require('razorpay');
const ejs = require('ejs');
const crypto = require('crypto');
const {
    METHODS
} = require('http');
const mux = require('@mux/mux-node');
const fs = require('fs');
const request = require('request');
const UpChunk = require('@mux/upchunk');
const {
    log,
    Console
} = require('console');
const busboy = require('connect-busboy');
const AuthenticationClient = require('auth0').AuthenticationClient;
const ManagementClient = require('auth0').ManagementClient;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');



const corsOptions = {
    origin: process.env.CORS_ORGIN,
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200
}
const app = express();

const razorInstance = new Razorpay({
    key_id: process.env.RAZOR_KEY_ID,
    key_secret: process.env.RAZOR_KEY_SECRET
});
const {
    Video,
    Data
} = new mux(process.env.MUX_ID, process.env.MUX_SECRET);

app.use(cors(corsOptions));
app.use(express.static('src'));
app.use('/api/payment', express.static('public'));
app.use('/', express.static('public'));
app.set('view engine', 'ejs')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(busboy());
app.use(busboy({
    immediate: true
}));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

const config = {
    idpLogout: true,
    authRequired: false,
    auth0Logout: true,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    secret: process.env.SECRET,
    routes: {
        login: false,
        postLogoutRedirect: '/api/log-out'
    }

};

// const AuthClient = new AuthenticationClient({
//     domain : 'guitar-auth0.eu.auth0.com',
//     clientId : process.env.GLOBAL_AUTH_CLIENT_ID,
//     clientSecret : process.env.GLOBAL_AUTH_CLIENT_SECRET
// });
// let access_token;
// AuthClient.clientCredentialsGrant({audience:'https://guitar-auth0.eu.auth0.com/api/v2/',scope:'{MANAGEMENT_API_SCOPES}'},(err,response)=>{
//     if(err){
//         console.error(err);
//     }
//     console.log(response);
//     access_token = response.access_token;
// });


const AuthManager = new ManagementClient({
    clientId: process.env.GLOBAL_AUTH_CLIENT_ID,
    domain: 'guitar-auth0.eu.auth0.com',
    clientSecret: process.env.GLOBAL_AUTH_CLIENT_SECRET,
    scope: "read:users create:users update:users"
});

app.use(auth(config));

app.use(function (req, res, next) {
    res.locals.user = req.oidc.user;
    next();
});



const client = mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});


const uploadSchema = new mongoose.Schema({
    mux_upload_id: String,
    type: String,
    mux_assest_id: String,
    mux_playback_id: String
});
const Upload = new mongoose.model('Upload', uploadSchema);

const messageSchema = new mongoose.Schema({
    _student_id: String,
    _mentor_id: String,
    chats: [{
        sender: Boolean,
        text: String,
        flag: Boolean,
        time: Date

    }]
});
const Messenger = new mongoose.model('Messenger', messageSchema);

const userSchema = new mongoose.Schema({
    authID: String,
    email: String,
    password: String,
    username: String,
    verification: Boolean,
    subscribed_plan: String,
    plan_expiry: String,
    razorpay_customer_id: String,
    subscription_id: String,
    mentor_status: Boolean,
    plan_status: Boolean,
    plan_history: [{
        subscribed_on_date: String,
        transaction_id: String,
        razorpay_payment_ID: String,
        invoice_id: String,
        invoice_link: String
    }],
    enrolled_courses: [{
        course_id: String,
        course_title: String,
        course_completion: Number,
        course_plan: String
    }],
    current_mentor: {
        mentor_auth_id: String,
        mentor_email: String
    },
    mentor_history: [{
        mentor_auth_id: String,
        mentor_email: String
    }],
    tasks: [{
        task_name: String,
        task_description: String,
        task_type: String,
        uploads: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: Upload
        },
        date: {
            type: Date,
            default: Date.now
        }
    }]
});
const User_Student = new mongoose.model('User_Student', userSchema);

const courseSchema = new mongoose.Schema({
    course_title: String,
    course_features: String,
    short_description: String,
    subscription_plan: String,
    course_description: String,
    status: Boolean,
    course_img: {
        content_type: String,
        image: Buffer
    },
    modules: [{
        title: String,
        content: String,
        playback_id: String,
        upload: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: Upload
        },
        module_status: Boolean,
        notes_status: Boolean,
        notes: {
            title: String,
            link: String
        }
    }]
});
const Courses = new mongoose.model('course', courseSchema);

const archiveSchema = new mongoose.Schema({
    archive_name: String,
    archive_description: String,
    archive_status: Boolean,
    modules: [{
        module_name: String,
        module_upload: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'Upload'
        },
        module_description: String
    }]
});
const Archive = new mongoose.model('archive', archiveSchema);

const announcmentSchema = new mongoose.Schema({
    date: String,
    message: String,
    preferred_user: String,
    target_user_status: Boolean,
    target_users: [{
        user_id: String
    }]
});
const Announcments = new mongoose.model('announcement', announcmentSchema);

const planDetails = new mongoose.Schema({
    plan_name: String,
    plan_rate: Number,
    plan_curreny: String,
    plan_period: String,
    razorpay_plan_id: String,
    plan_type: String,
    plan_interval: Number,
});
const Plan = new mongoose.model('plan', planDetails);

const mentorSchema = new mongoose.Schema({
    authID: String,
    username: String,
    email: String,
    status: Boolean,
    students: [{
        email: String,
        authID: String,
        subscribed_plan: String,
        issueDate: {
            type: Date,
            default: Date.now()
        }
    }],
    assigned_courses: [{
        course_id: {
            type: mongoose.SchemaTypes.ObjectId,
            rel: Courses
        }
    }]
});
const Mentor = new mongoose.model('Mentor', mentorSchema);

const groupSchema = new mongoose.Schema({
    email: String,
    password: String,
    verification: Boolean,
    subscribed_plan: String,
    authID: String,
    plan_expiry: String,
    maximum_size: Number,
    razorpay_customer_id: String,
    group_members: [{
        member_email: String,
        member_auth_id: {
            type: mongoose.SchemaTypes.ObjectId,
            rel: User_Student,
            unique: true,
        }
    }],
    plan_history: [{
        subscribed_plan_name: String,
        subscribed_on_date: String,
        subscribed_transaction_id: String,
        razorpay_payment_ID: String,
        payment_link: {
            razorpay_payment_link: String,
            status: String
        }
    }],

    current_mentor: {
        mentor_authID: String,
        mentor_email: String
    },
    mentor_history: [{
        mentor_id: String,
        mentor_name: String
    }],

});
const Group = new mongoose.model('group', groupSchema);

const allUsersSchema = new mongoose.Schema({
    authID: {
        type: String,
        unique: true
    },
    role: String
});
const User = new mongoose.model('User', allUsersSchema);

const contactUsSchema = new mongoose.Schema({
    email: String,
    subject: String,
    message: String,
    date: {
        type: Date,
        default: Date.now
    }
});
const Contact_Us = new mongoose.model('Contact Us', contactUsSchema);

passport.use(new LocalStrategy({
    passReqToCallback: true
}, (req, username, password, cb) => {

    process.nextTick(() => {
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            return cb(null, {
                username: username
            });
        } else {
            return cb(null, false);
        }
    });
}));
passport.serializeUser((user, done) => {
    done(null, user.username);
});
passport.deserializeUser((username, done) => {
    done(null, {
        username: process.env.ADMIN_USERNAME
    });
});


// const newPlan = new Plan({
//     plan_name : "plus",
//     plan_rate : 500,
//     plan_curreny : "INR",
//     razorpay_plan_id : "plan_KfUTdm9pE8pP94"
// })

// newPlan.save();

// ############################### API CALLS  ##############




app.get('/api/message/student/:studentID/mentor/:mentorID', requiresAuth(), (req, res) => {
    Messenger.findOne({
        _student_id: req.params.studentID,
        _mentor_id: req.params.mentorID
    }, (err, data) => {
        res.json(data);
    });
});



app.get('/api/get/:role', requiresAuth(), (req, res) => {
    if (req.params.role === 'student') {
        User_Student.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err) {
                console.log(err);
            } else {
                res.json({
                    response: data,
                    imgURL: req.oidc.user.picture
                });
            }
        });
    } else if (req.params.role === 'mentor') {
        Mentor.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err) {
                console.log(err);
            } else {
                res.json({
                    auth: true,
                    response: data,
                    imgURL: req.oidc.user.picture
                });
            }
        });
    } else if (req.params.role === 'parent') {
        Group.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err) {
                console.error(err);
                req.json({
                    auth: false
                });
            } else {
                res.json({
                    auth: true,
                    response: data,
                    imgURL: req.oidc.user.picture
                });
            }
        });
    } else {
        res.json({
            auth: false
        });
    }
});



app.post('/api/message/student/:studentID/mentor/:mentorID', requiresAuth(), (req, res) => {
    Messenger.updateOne({
        _student_id: req.params.studentID,
        _mentor_id: req.params.mentorID
    }, {
        $push: {
            chats: {
                text: req.body.message,
                flag: req.body.flag,
                time: Date.now(),
            }
        }
    }, (err) => {
        if (err) {
            res.sendStatus(404)
        } else {
            res.sendStatus(200);
        }

    });
});

app.post('/api/enrollcourse', requiresAuth(), (req, res) => {
    User_Student.findOne({
        authID: req.oidc.user.sub
    }, (err, Userdata) => {
        Courses.findOne({
            _id: req.body.course_id
        }, '_id subscription_plan course_title', (err, courseData) => {
            console.log(courseData.subscription_plan);
            console.log(Userdata.subscribed_plan);

            function authReq() {
                if (courseData.subscription_plan === "free")
                    return true;
                else if (((courseData.subscription_plan === "pro" && (Userdata.subscribed_plan === "pro" || Userdata.subscribed_plan === "plus")) || (courseData.subscription_plan == 'plus' && (Userdata.subscribed_plan === "plus"))) && Userdata.plan_status)
                    return true;
                else
                    return false;
            }
            if ((!err && authReq())) {
                User_Student.updateOne({
                    authID: req.oidc.user.sub
                }, {
                    $push: {
                        enrolled_courses: {
                            course_id: courseData._id,
                            course_completion: 0,
                            course_title: courseData.course_title,
                            course_plan: courseData.subscription_plan
                        }
                    }
                }, (Usererr) => {
                    if (!err) {
                        res.sendStatus(200);
                    } else {
                        res.sendStatus(500);
                    }
                    res.end();
                });
            } else {
                res.sendStatus(500);
                console.log(err);
            }

        });
    });
});

app.get('/api/explore', (req, res) => {
    Courses.find({
        status: true
    }, '_id course_title course_features subscription_plan short_description', (err, data) => {
        if (!err)
            res.json({
                data: data,
                auth: req.oidc.isAuthenticated()
            });
        else {
            console.log(err);
            res.sendStatus(500);
        }
    });
});

app.get('/api/explore/:courseID', (req, res) => {
    Courses.findOne({
        _id: req.params.courseID,
        status: true
    }, '_id course_title course_features subscription_plan course_img course_description modules.title modules.content', (err, resData) => {
        if (!err)
            res.json({
                data: resData,
                response: true,
                auth: req.oidc.isAuthenticated()
            });
        else
            res.json({
                response: false
            });
        console.log(err);
    });
});



app.get('/api/mylearning/:courseID', requiresAuth(), (req, res) => {
    User_Student.findOne({
        authID: req.oidc.user.sub
    }, (err, data) => {
        function getCourse() {
            for (var iter = 0; iter < data.enrolled_courses.length; iter++) {
                if (data.enrolled_courses[iter].course_id === req.params.courseID) {
                    if (data.enrolled_courses[iter].course_plan === "free")
                        return true;
                    else if (data.enrolled_courses[iter].course_plan === 'pro' && (data.subscribed_plan === 'pro' || data.subscribed_plan === 'plus'))
                        return true;
                    else if (data.enrolled_courses[iter].course_plan === 'plus' && (data.subscribed_plan === 'plus'))
                        return true;
                    else
                        return false;
                }
            }
            return false
        }
        if (getCourse()) {
            Courses.findOne({
                _id: req.params.courseID,
                status: true
            }, (cerr, courseData) => {
                if (!cerr) {
                    res.json({
                        course_data: courseData,
                        user_data: data,
                        access: true
                    })
                }
            });
        } else {
            res.json({
                access: false
            })
        }

    });
});

app.post('/api/mylearning/:courseID/:moduleNum', requiresAuth(), (req, res) => {
    User_Student.updateOne({
        authID: req.oidc.user.sub,
        "enrolled_courses.course_id": req.params.courseID
    }, {
        "enrolled_courses.$.course_completion": req.params.moduleNum
    }, (err) => {
        if (!err)
            res.sendStatus(200);
        else
            console.log(err);
    });
});

app.get('/api/verify', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        User.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err == null) {
                res.json({
                    auth: true,
                    imgURL: req.oidc.user.picture,
                    role: data.role
                });
            } else {
                console.error(err);
            }
        });
    } else {
        res.json({
            auth: false
        });
    }
});

// ########## VIDEO STREAMING

// ######## LOGIN/SIGN UP METHODS
app.get('/api/login', (req, res) => {
    if (req.query.role === "student" || req.query.role === "mentor" || req.query.role === "parent") {
        res.oidc.login({
            returnTo: '/api/profile?role=' + req.query.role
        });
    } else {
        res.send("Invalid URL");
    }

});

app.get('/api/logout', (req, res) => {
    res.oidc.logout({
        returnTo: '/api/log-out'
    });
});

app.get('/api/log-out', (req, res) => {
    res.redirect(process.env.APP_URL);
});


// Redirect to Profile
app.get('/api/profile', requiresAuth(), (req, res) => {
    if (req.query.role === "student" || req.query.role === "mentor" || req.query.role === "parent") {
        User.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err || data) {
                console.log(err || "User Already Exists");

            } else {
                const newUser = new User({
                    authID: req.oidc.user.sub,
                    role: req.query.role
                });
                newUser.save();
            }
        });

    }
    if (req.query.role === "mentor") {
        Mentor.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err || data) {
                console.log(err || "Email Already Exists");
            } else {
                const newMentor = new Mentor({
                    authID: req.oidc.user.sub,
                    email: req.oidc.user.email,
                    username: req.oidc.user.username,
                    students: [],
                    status: false,
                    assigned_courses: []
                });
                newMentor.save();
            }
        });
        res.redirect(process.env.APP_URL + '/dashboard/mentor/profile');

    } else if (req.query.role === "student") {
        User_Student.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err) {
                console.log(err);
            } else if (data == null) {
                razorInstance.customers.create({
                    name: req.oidc.user.username,
                    email: req.oidc.user.email,
                    notes: {
                        role: req.params.role,
                        authID: req.oidc.user.sub
                    }
                }, (cusErr, newCustomer) => {
                    if (!cusErr) {
                        const newUser = new User_Student({
                            authID: req.oidc.user.sub,
                            email: req.oidc.user.email,
                            username: req.oidc.user.username,
                            subscribed_plan: "free",
                            razorpay_customer_id: newCustomer.id,
                            mentor_access: false,
                            subscription_status: false,
                            manual_add: false
                        });
                        newUser.save((serr) => {
                            if (serr) {
                                res.sendStatus(500);
                                console.log(serr);

                            }

                        });
                    }
                });

            }
            res.redirect(process.env.APP_URL + '/dashboard/student/courses');
        });

    } else if (req.query.role === "parent") {
        Group.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (data == null) {
                razorInstance.customers.create({
                    name: req.oidc.user.username,
                    email: req.oidc.user.email,
                    notes: {
                        role: req.params.role,
                        authID: req.oidc.user.sub
                    }
                }, (cusErr, newCustomer) => {
                    if (!err) {
                        const newGroup = new Group({
                            authID: req.oidc.user.sub,
                            email: req.oidc.user.email,
                            username: req.oidc.user.username,
                            subscription_plan: "free",
                            maximum_size: 0,
                            razorpay_customer_id: newCustomer.id
                        });
                        newGroup.save((serr) => {

                            if (serr) {
                                res.sendStatus(500);
                                console.log(serr);
                            }
                        })

                    }
                });
            } else if (err) {
                res.sendStatus(500);
                console.log(err);
            }
            res.redirect(process.env.APP_URL + '/dashboard/parent/profile');
        });
    } else {
        res.sendStatus(500);
        console.log("Invalid URL");
    }

});


//HOME PAGE VERIFY AUTHENTICATION
// ########## PAYMENT METHODS

app.get('/api/payment/:planID', requiresAuth(), (req, res) => {
    if (req.query.role === "student") {
        User_Student.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (!err) {
                razorInstance.subscriptions.create({
                    plan_id: req.params.planID,
                    customer_id: data.razorpay_customer_id,
                    quantity: 1,
                    total_count: 12,
                    notes: {
                        role: req.query.role,
                        authID: data.authID
                    }
                }, (subErr, subData) => {
                    if (!subErr) {
                        res.render('paymentPage', {
                            subscription_id: subData.id,
                            key: process.env.RAZOR_KEY_ID,
                            role: "student",
                            planID: req.query.plan,
                            user: data
                        });
                    }
                });
            } else {
                res.sendStatus(500);
                console.log(err);
            }
        })
    } else {
        res.sendStatus(500);
    }
});

app.post('/payment-success', requiresAuth(), (req, res) => {
    console.log(req.body);
    const body = req.body.razorpay_payment_id + '|' + req.query.subscriptionid;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZOR_KEY_SECRET).update(body.toString()).digest('hex');
    console.log(expectedSignature, req.query.subscriptionid);
    if (expectedSignature === req.body.razorpay_signature) {
        if (req.query.role = "student" && req.query.planId == ("pro" || "plus")) {
            User_Student.updateOne({
                authID: req.oidc.user.sub
            }, {
                subscribed_plan: req.query.planId,
                subscription_id: req.query.subscriptionid,
                subscription_status: true,
                $push: {
                    plan_history: {
                        subscribed_on_date: Date.now(),
                        razorpay_payment_ID: req.body.razorpay_payment_id,
                    }
                }
            }, (err) => {
                if (!err) {
                    res.redirect(process.env.APP_URL + '/dashboard/student/courses');
                } else {
                    console.log(err);
                }
            });
        }
    } else {
        res.send('Invalid Credentials! Retry Payment');
    }
});

// ###### ADMIN CALLS

app.get('/', (req, res) => {
    res.render('admin_login');
});

app.post('/', passport.authenticate('local', {
    failureRedirect: '/',
}), (req, res) => {
    res.redirect('/admin');
});

async function* loadYieldResponse() {
    yield await User.find({});
    yield await User_Student.find({}).sort({
        date: -1
    });
    yield await Courses.find({}).count();
    yield await Mentor.find({}, {}, {
        sort: {
            created_at: -1
        }
    });
    yield await User_Student.find({
        subscribed_plan: 'free'
    }).count();
    yield await Group.find({}).count();
    yield await Plan.find({}).count();
}
async function loadResponse() {
    let arr = [];
    for await (const res of loadYieldResponse()) {
        arr.push(res);
    }

    return await Promise.resolve({
        signup: arr[0].length,
        all_students: arr[1].length,
        userData: arr[1].slice(0, 6),
        courses: arr[2],
        mentors: arr[3].length,
        mentorData: arr[3].slice(0, 6),
        free_students: arr[4],
        total_groups: arr[5],
        total_plans: arr[6]
    })
}
app.get('/admin', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const response = loadResponse();
        response.then((data, err) => {
            if (!err) {
                res.render('admin', {
                    data: data
                });
            } else {
                console.error(err);
            }

        });
    }


});

app.get('/admin/students', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        User_Student.find({}, (err, data) => {
            res.render('students', {
                data: data
            });
        });
    }


});

app.get('/admin/mentors', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.find({}, (err, data) => {
            res.render('mentor', {
                data: data
            });
        });
    }

});

app.get('/admin/student/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {

        User_Student.findOne({
            _id: req.params.id
        }, (err, data) => {
            if (!err) {
                Mentor.find({
                    status: true
                }, 'email _id', (merr, mentorData) => {
                    if (!merr)
                        res.json({
                            data: data,
                            mentorList: mentorData
                        });
                });

            } else {
                res.send('ERROR 404! Page Not Found');
            }
        });
    }


});

app.get('/admin/groups', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Group.find({}, (err, data) => {
            if (!err)
                res.render('group', {
                    data: data
                });
        });
    }


});

app.get('/admin/mentor/:id', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.findOne({
            _id: req.params.id
        }, (err, data) => {
            if (!err) {
                res.json({
                    data: data
                });
            } else {
                res.status(403);
            }
        });
    }


});


app.get('/admin/groups', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {

        Group.find({}, (err, data) => {
            if (err == null) {
                res.render('groups', {
                    data: data
                });
            } else {
                console.error(err);
                res.sendStatus(404);
            }
        });
    }

});



app.get('/admin/plans', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Plan.find({}, (err, data) => {
            if (err == null) {
                res.render('plan', {
                    data: data
                });
            }
        });
    }


});

app.post('/admin/plan', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        razorInstance.plans.create({
            period: req.body.period,
            interval: req.body.plan_interval,
            item: {
                name: req.body.plan_name,
                amount: parseInt(req.body.plan_amount),
                currency: req.body.plan_currency
            }
        }, (err, data) => {
            if (err) {
                console.error(err);
                res.sendStatus(500);
            } else {
                Plan.create({
                    plan_name: req.body.plan_name,
                    plan_interval: req.body.plan_interval,
                    plan_type: req.body.plan_type,
                    plan_rate: req.body.plan_amount,
                    razorpay_plan_id: data.id,
                    plan_period: req.body.period,
                    plan_currency: req.body.plan_currency
                }, (saveErr) => {
                    if (!saveErr) {
                        res.sendStatus(200);
                    } else {
                        console.error(saveErr);
                        res.sendStatus(500);
                    }
                });
            }
        });
    }



});



app.post('/admin/access/:id', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.updateOne({
            _id: req.params.id
        }, {
            status: req.body.status
        }, (err) => {
            if (!err) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    }



});

app.get('/admin/get/mentor', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.find({
            status: true
        }, "authID email", (err, data) => {
            if (!err) {
                res.json({
                    mentors: data
                });
            } else {
                console.error(err);
            }
        });
    }


});

app.post('/admin/assignMentor', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const mentor_data = {
            "mentor_auth_id": req.body.mentor_authID,
            "mentor_email": req.body.mentor_email
        };
        User_Student.updateOne({
            authID: req.body.student_authID
        }, {
            $set: {
                "current_mentor.mentor_auth_id": req.body.mentor_authID,
                "current_mentor.mentor_email": req.body.mentor_email
            },
            "mentor_status": true,
            "$push": {
                "mentor_history": mentor_data
            }
        }, (err) => {
            if (err == null) {
                Mentor.updateOne({
                    authID: req.body.mentor_authID
                }, {
                    $push: {
                        students: {
                            email: req.body.student_email,
                            authID: req.body.student_authID,
                            subscribed_plan: req.body.student_plan
                        }
                    }
                }, (Menerr) => {
                    if (Menerr == null) {
                        Messenger.findOne({
                            _student_id: req.body.student_authID,
                            _mentor_id: req.body.mentor_authID
                        }, (Meserr, MesData) => {
                            if (Meserr == null && MesData == null) {
                                const newMessage = new Messenger({
                                    _student_id: req.body.student_authID,
                                    _mentor_id: req.body.mentor_authID
                                });
                                newMessage.save((serr) => {
                                    if (!err) {
                                        res.sendStatus(200);
                                    } else {
                                        res.sendStatus(403);
                                    }
                                });
                            } else if (Meserr != null) {
                                res.sendStatus(403);
                                console.error("Mes", Meserr);
                            } else {
                                res.sendStatus(200);
                            }
                        })

                    } else {
                        res.sendStatus(403);
                        console.error("Men", Menerr);
                    }
                })

            } else {
                res.sendStatus(403);
                console.log("User", err);
            }

        });
    }


});

app.post('/admin/assigncourse', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.updateOne({
            authID: req.body.authID
        }, {
            $push: {
                assigned_courses: {
                    course_id: req.body.course_id
                }
            }
        }, (err) => {
            if (!err) {
                res.sendStatus(200);
            } else {
                res.sendStatus(500);
            }
            res.end();
        });
    }


});

app.get('/admin/courses', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Courses.find({})
            .populate('modules.upload')
            .exec((err, data) => {
                if (!err) {
                    res.render('courses', {
                        data: data
                    });
                } else {
                    console.error(err);
                    res.send("Something went wrong! Try again later");
                }

            });
    }


});

app.post('/admin/post/course', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        req.pipe(req.busboy);
        let formData = new Map();
        let bufs = [];
        req.busboy.on('field', (fieldName, fieldValue) => {
            console.log(fieldName, fieldValue);
            formData.set(fieldName, fieldValue);
        });
        req.busboy.on('file', (fileName, file, fileInfo, encoding, minitype) => {

            file.on('data', (data) => {
                if (data != null)
                    bufs.push(data);
            });

        });
        req.busboy.on('finish', () => {
            const newCourse = new Courses({
                course_title: formData.get('title'),
                course_features: formData.get('features'),
                course_description: formData.get('short-des'),
                subscription_plan: formData.get('plan'),
                course_img: {
                    image: Buffer.concat(bufs),
                    content_type: 'image/png'
                },
                status: false,
                modules: []
            });
            newCourse.save((err) => {
                if (!err) {
                    res.redirect('/admin/courses');
                } else {
                    console.error(err);
                }
            });
        });
    }



});


app.post('/admin/post/module', async (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const newUpload = await Video.Uploads.create({
            cors_origin: process.env.MUX_WEBHOOK_URL,
            new_asset_settings: {
                playback_policy: 'public'
            }
        });
        Upload.create({
            mux_upload_id: newUpload.id,
            type: "course"
        }, (err, uploadData) => {
            if (!err) {
                Courses.updateOne({
                    _id: req.body.course_id
                }, {
                    $push: {
                        modules: {
                            title: req.body.module_title,
                            content: req.body.module_content,
                            upload: uploadData._id,
                            module_status: false,
                            // notes_status:req.body.notes_status,
                            // notes : {
                            //     notes_title:req.body.notes_title,
                            //     notes_link : req.body.notes_link
                            // } 
                        }
                    }
                }, (courerr) => {
                    if (courerr) {
                        res.json({
                            res: false
                        });
                        console.log(courerr);
                    } else {
                        res.json({
                            res: true,
                            upload_url: newUpload.url
                        });
                    }
                });
            } else {
                res.json({
                    res: false
                });
                console.log(err);
            }
        });
    }
});

app.post('/admin/post/access/:query', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        if (req.params.query === 'course') {
            Courses.updateOne({
                _id: req.body.course_id
            }, {
                status: req.body.status
            }, (err) => {
                if (!err)
                    res.sendStatus(200);
                else
                    console.log(err);
            });
        } else if (req.params.query === 'module') {
            Courses.updateOne({
                _id: req.body.course_id,
                "modules._id": req.body.module_id
            }, {
                "modules.$.modules_status": req.body.status
            }, (err) => {
                if (!err)
                    res.sendStatus(200);
                else
                    console.log(err);
            });
        } else if (req.params.query === 'notes') {
            Courses.updateOne({
                _id: req.body.course_id,
                "modules._id": req.body.module_id
            }, {
                "modules.$": {
                    $push: {
                        notes: {
                            notes_title: req.body.notes_title,
                            notes_link: req.body.notes_link
                        }
                    }
                }
            }, (err) => {
                if (!err)
                    res.sendStatus(200);
                else
                    console.log(err);
            });
        } else
            res.sendStatus(403);
    }
});
app.get('/admin/courses/:courseID', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Courses
            .findOne({
                _id: req.params.courseID
            })
            .populate('modules.upload')
            .exec((err, data) => {
                if (!err) {
                    res.render('courseView', {
                        data: data
                    });
                } else {
                    console.log(err);
                }
            });
    }
});

app.post('/admin/post/user', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const newUser = {
            email: req.body.email,
            password: req.body.password,
            username: req.body.username,
            connection: "Guite-Site-AuthDB"
        };
        try {
            AuthManager.users.create(newUser, (err, user) => {
                if (!err) {
                    const newUserStudent = new User_Student({
                        email: user.email,
                        authID: user.user_id,
                        mentor_access: true,
                        subscribed_plan: req.body.plan,
                        subscription_status: true,
                        manual_add: true,
                        mentors: []
                    });
                    newUserStudent.save((saveErr) => {
                        if (!err)
                            res.json({
                                res: true
                            });
                        else {
                            res.json({
                                res: false
                            });
                            console.error(saveErr);
                        }

                    });
                } else {
                    res.json({
                        res: false
                    });
                    console.error(err);
                }
            });
        } catch (err) {
            console.error(err);
            res.json({
                res: false
            });
        }
    }


});


app.get('/admin/archives', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        try {
            Archive.find({})
                .exec((err, data) => {
                    if (!err)
                        res.render('archives', {
                            data: data
                        });
                    else {
                        console.error(err);
                    }
                });
        } catch (err) {
            console.error(err);
        }
    }


});

app.post('/admin/archives/category', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Archive.create({
            archive_name: req.body.archive_name,
            archive_description: req.body.archive_description,
            archive_status: false,
            modules: []
        }, (err) => {
            if (!err) {
                res.json({
                    res: true
                });
            } else {
                res.json({
                    res: false
                });
                console.error(err);
            }
        });
    }


});

app.post('/admin/archives/access', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        try {
            Archive.updateOne({
                _id: req.body.archive_id
            }, {
                archive_status: req.body.archive_status
            }, (err) => {
                if (!err) {
                    res.json({
                        res: true
                    });
                } else {
                    res.json({
                        res: false
                    });
                    console.error(err);
                }
            })
        } catch (err) {
            console.error(err);
        }

    }
});

app.get('/admin/archives/get/:id', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Archive
            .findOne({
                _id: req.params.id
            })
            .populate('modules')
            .exec((err, data) => {
                if (err) {
                    console.log(err);
                    res.send("Something went wrong! Try again later");
                    res.end();
                } else
                    res.render('archiveView', {
                        data: data
                    });
            });

    }


});

app.post('/admin/archives/module', async (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const newUpload = await Video.Uploads.create({
            cors_origin: process.env.MUX_WEBHOOK_URL,
            new_asset_settings: {
                playback_policy: 'public'
            }
        });
        Upload.create({
            mux_upload_id: newUpload.id,
            type: "archive"
        }, (err, uploadData) => {
            if (!err) {
                Archive.updateOne({
                    _id: req.body.archive_id
                }, {
                    $push: {
                        modules: {
                            module_name: req.body.module_name,
                            module_upload: uploadData._id,
                            module_description: req.body.module_description,
                            module_status: false
                        }
                    }
                }, (err) => {
                    if (!err) {
                        res.json({
                            url: newUpload.url
                        });
                    }
                })
            }
        });

    }


});


// ######### Files Serving

app.get('/sources/js/passwordscript', (req, res) => {
    res.sendFile(__dirname + "/passwordValidate.js");
});


// ######## Webhhook
app.post('/mux/webhook', (req, res) => {
    if (req.body.data.status === "ready" && req.body.type === "video.asset.ready") {
        try {
            Upload.updateOne({
                "mux_upload_id": req.body.data.upload_id
            }, {
                "mux_assest_id": req.body.object.id,
                "mux_playback_id": req.body.data.playback_ids[0].id
            }, err => {
                if (err)
                    console.error(err);
            })
        } catch (err) {
            console.error(err);
        }
        // Courses.updateOne({
        //     "modules.mux_upload_id": req.body.data.upload_id
        // }, {
        //     "modules.$.mux_asset_id": req.body.object.id,
        //     "modules.$.playback_id": req.body.data.playback_ids[0].id
        // }, (err) => {
        //     if (err)
        //         console.log(err);
        // });
    }
});

app.listen(3001 || process.env.PORT, (err) => {
    if (!err) {
        console.log("Server Initiated port : 3001");
    }
});