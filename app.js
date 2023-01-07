require('dotenv').config();
const express = require('express');
const router = require('express').Router();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const proxy = require('express-request-proxy');
const https = require('https');
const cors = require('cors');
const {
    auth,
    requiresAuth
} = require('express-openid-connect');
const openIdConnect = require('express-openid-connect');


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
const jar = request.jar();
const {
    log,
    Console
} = require('console');
const busboy = require('connect-busboy');
const ManagementClient = require('auth0').ManagementClient;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const console = require('console');

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
app.set("trust proxy", true);
app.use(express.static('src'));
app.use('/api/payment', express.static('public'));
app.use('/', express.static('public'));
app.set('view engine', 'ejs')

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
        callback :'/callback',
        login: false,
        postLogoutRedirect: '/api/logout'
    }

};
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));



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
    mux_playback_id: String,
    created_at : {
        type:Date,
        default: Date.now
    }
});
const Upload = new mongoose.model('Upload', uploadSchema);

const messageSchema = new mongoose.Schema({
    _student_id: String,
    _mentor_id: String,
    chats: [{
        sender: Boolean,
        text: String,
        flag: Boolean,
        created_at: {
            type : Date,
            default : Date.now
        }
    }],
    created_at : {
        type : Date,
        default : Date.now
    }

});
const Messenger = new mongoose.model('Messenger', messageSchema);

const userSchema = new mongoose.Schema({
    authID: String,
    email: String,
    verification: Boolean,
    subscribed_plan: String,
    plan_expiry: String,
    razorpay_customer_id: String,
    subscription_id: String,
    mentor_status: Boolean,
    plan_status: Boolean,
    plan_status_des : String,
    manual_add : Boolean,
    group_status : {
        type : Boolean,
        default : false,
    },
    group : {
        type : mongoose.SchemaTypes.ObjectId,
        ref : 'Group'
    },
    plan_history: [{
        subscribed_on_date: Date,
        razorpay_payment_ID: String,
        subscription_id : String,
        invoice_id: String,
        invoice_link: String
    }],
    enrolled_courses: [{
        course: {
            type : mongoose.SchemaTypes.ObjectId,
            ref : 'Course'
        },
        course_completion: Number,
        created_at : {
            type : Date,
            default : Date.now,
        }
    }],
    current_mentor: {
        mentor: {
            type : mongoose.SchemaTypes.ObjectId,
            ref : 'Mentor'
        },
        created_at : {
            type : Date,
            default : Date.now,
        }
    },
    mentor_history: [{
        mentor: {
            type : mongoose.SchemaTypes.ObjectId,
            ref : 'Mentor'
        }
    }],
    tasks: [{
        task_name: String,
        task_description: String,
        task_type: String,
        uploads: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'Upload'
        },
        created_at: {
            type: Date,
            default: Date.now
        }
    }],
    created_at : {
        type:Date,
        default : Date.now
    }
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
        module_type : {
            type : Boolean,
        },
        notes_status: Boolean,
        notes: {
            title: String,
            link: String
        }
    }],
    created_at : {
        type:Date,
        default : Date.now
    }
});
const Courses = new mongoose.model('Course', courseSchema);

const archiveSchema = new mongoose.Schema({
    archive_name: String,
    archive_description: String,
    archive_status: Boolean,
    archive_type : String,
    modules: [{
        module_name: String,
        module_upload: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'Upload'
        },
        module_description: String
    }],
    created_at :{
        type : Date,
        default  : Date.now,
    }
});
const Archive = new mongoose.model('archive', archiveSchema);

const announcmentSchema = new mongoose.Schema({
    date: String,
    message: String,
    preferred_user: String,
    target_user_status: Boolean,
    target_users: [{
        user_id: String
    }],
    created_at : {
        type:Date,
        default : Date.now
    }
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
    created_at : {
        type:Date,
        default : Date.now
    }
});
const Plan = new mongoose.model('plan', planDetails);

const mentorSchema = new mongoose.Schema({
    authID: String,
    username: String,
    email: String,
    status: Boolean,
    students: [{
       student : {
        type:mongoose.SchemaTypes.ObjectId,
        ref : 'User_Student',
       },
        created_at: {
            type: Date,
            default: Date.now
        }
    }],
    groups : [{
        student : {
            type : mongoose.SchemaTypes.ObjectId,
            ref : 'Group'
        },
        created_at : {
            type : Date,
            default : Date.now
        }
    }],
    assigned_courses: [{
        course: {
            type: mongoose.SchemaTypes.ObjectId,
            rel: 'Courses'
        }
    }],

});
const Mentor = new mongoose.model('Mentor', mentorSchema);

const groupSchema = new mongoose.Schema({
    email: String,
    verification: Boolean,
    subscribed_plan: String,
    authID: String,
    plan_expiry: String,
    maximum_size: Number,
    razorpay_customer_id: String,
    subscription_id : String,
    mentor_status : {
        type : Boolean,
        default : false,
    },
    group_status : {
        type : Boolean,
        default : false
    },
    plan_initial_status : {
        user_status : {
            type : Boolean,
            default : false
        },
        admin_status : {
            type : Boolean,
            default : false
        }
    },
    plan_status : {
        type : Boolean,
        default : false
    },
    plan_status_des : String,
    group_members: [{
        member: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'User_Student',
        }
    }],
    request : {
        created_at : {
            type : Date
        },
        maximum_size : Number,
        plan : String,
        members : [{
            member_email : String,
            member_auth_id : String
        }],
        request_status : {
            type : Boolean,
            default : false,
        },
        response_status : {
            type : Boolean,
            default:false
        },
        response_message : String  
    },
    plan_history: [{
        created_at: {
            type : Date
        },
        subscription_id: String,
        razorpay_payment_ID: String,
        invoice_id : String,
        invoice_link : String,
    }],

    current_mentor: {
        mentor : {
            type : mongoose.SchemaTypes.ObjectId,
            ref: 'Mentor',
        }
    },
    mentor_history: [{
        mentor : {
            type : mongoose.SchemaTypes.ObjectId,
            ref: 'Mentor',
        }
    }],
});
const Group = new mongoose.model('Group', groupSchema);

const allUsersSchema = new mongoose.Schema({
    authID: {
        type: String,
        unique: true
    },
    role: String,
    created_at :{
        type : Date,
        default : Date.now
    }
});
const User = new mongoose.model('User', allUsersSchema);

const contactUsSchema = new mongoose.Schema({
    email: String,
    subject: String,
    message: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});
const Contact_Us = new mongoose.model('Contact Us', contactUsSchema);

const homeSchema = new mongoose.Schema({
    student_description : String,
    mentor_description : String,
    group_description : String,
    featured_course_1 : {
        type : mongoose.SchemaTypes.ObjectId,
        ref : 'Course'
    },
    featured_course_2 : {
        type : mongoose.SchemaTypes.ObjectId,
        ref : 'Course'
    },
    featured_course_3 : {
        type : mongoose.SchemaTypes.ObjectId,
        ref : 'Course'
    },
    about_description : String,
});
const Home_Data_Model = new mongoose.model('Home_Data',homeSchema);

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


app.post('/auth/callback',(req,res)=>{
    if(!req.headersSent){
        req.on('end',()=>{
            console.log('End');
        });
        const queryData = querystring.stringify(req.body);
        req.on('error',(err)=>{
            console.log('Error Occured',err)
        });
        const options = {
            url : 'http://guitar-site-87h3i.ondigitalocean.app/app/app/auth/callback',
            method :'POST',
            headers : {
                ...req.headers,
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Connection' : 'keep-alive',
                'Cookie' : req.headers.cookie
            },
            body : queryData,
            followRedirect : true,
            // followAllRedirects : true,
            cookies : req.cookies
        }
        request((options),(error,response,body)=>{
            res.json({error : error,res: response, body : req.body, data : queryData});
        });
    }
});



// ############################### API CALLS  ##############

router.get('/api/message/student/:studentID/mentor/:mentorID', requiresAuth(), (req, res) => {
    Messenger.findOne({
        _student_id: req.params.studentID,
        _mentor_id: req.params.mentorID
    }, (err, data) => {
        if(!err){
            if(data ===null){
                const newMessage = new Messenger({
                    _student_id : req.params.studentID,
                    _mentor_id : req.params.mentorID,
                    chats : []
                });
                newMessage.save((saveErr)=>{
                    if(!saveErr)
                        res.json({res:true,chats : []});
                    else 
                        res.json({res : false});
                });
            }else 
                res.json({res:true,chats:data.chats});
        }
        else{
            res.json({res : false});
            console.error(err);
        }
    });
});

router.post('/api/message/student/:studentID/mentor/:mentorID', requiresAuth(), (req, res) => {
    Messenger.updateOne({
        _student_id: req.params.studentID,
        _mentor_id: req.params.mentorID
    }, {
        $push: {
            chats: {
                text: req.body.message,
                flag: req.body.flag,
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

router.get('/api/get/:role', requiresAuth(), (req, res) => {
    if (req.params.role === 'student') {
        User_Student.findOne({
            authID: req.oidc.user.sub
        })
        .populate('enrolled_courses.course','_id course_title subscription_plan modules.title')
        .populate('current_mentor.mentor')
        .exec((err, data) => {
            if (err) {
                res.json({res : false})
                console.log(err);
            } else {
                res.json({
                    res : true,
                    response: data,
                    imgURL: req.oidc.user.picture
                });
            }
        });
    } else if (req.params.role === 'mentor') {
        Mentor.findOne({
            authID: req.oidc.user.sub
        })
        .populate('students.student')
        .populate({path : 'groups.student',populate : {path :'group_members.member'}})
        .exec((err, data) => {
            if (err) {
                res.json({res:false})
                console.log(err);
            } else {
                res.json({
                    res:true,
                    auth: true,
                    response: data,
                    imgURL: req.oidc.user.picture
                });
            }
        });
    } else if (req.params.role === 'group') {
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



router.post('/api/enrollcourse', requiresAuth(), (req, res) => {
    try {
        User_Student.findOne({authID : req.oidc.user.sub})
        .populate('group')
        .exec((uerr,user)=>{
            if(!uerr && user!=null){
                Courses.findOne({ _id : req.body.course_id})
               .exec((cerr,course)=>{
                    if(!cerr && course !=null){
                        async function validateReq(){
                            if(course.subscription_plan === 'free'){
                                return true;
                            }else if (user.manual_add === true && user.group_status===false){
                                if(((course.subscription_plan==='pro') && (user.subscribed_plan === 'pro' || user.subscribed_plan ==='plus')) || (course.subscription_plan ==='plus' && user.subscribed_plan ==='plus'))
                                    return true;
                                else 
                                    return false;
                            } else if (user.group_status){
                                if((((course.subscription_plan ==='pro') && (user.group?.subscribed_plan ==='pro' || user.group.subscribed_plan ==='plus')) || (course.group.subscribed_plan === 'plus' && user.group.subscribed_plan ==='plus')) && user.group.plan_status)
                                    return true;
                                else 
                                    return false;
                            }else if (((course.subscription_plan ==='pro' && user.subscribed_plan !='free') || (course.subscription_plan === 'plus' && user.subscribed_plan ==='plus')) && (user.plan_status && !user.manual_add)){
                                return true;
                            } else {
                                return false;
                            }
                        }
                        validateReq().then(response=>{
                             if(response){
                                User_Student.updateOne({authID:req.oidc.user.sub},{
                                    $push:{
                                        enrolled_courses:{
                                            course : course._id,
                                            course_completion : 0,
                                        }
                                    }
                                },(updateErr)=>{
                                    if(!updateErr){
                                        res.json({res:true});
                                    } else {
                                        res.json({res:false});
                                        console.error(updateErr)
                                    }
                                });
                            } else {
                                res.json({res:false});
                            }
                        });
                    } else {
                        res.json({res:false});
                        if(cerr)
                            console.error(cerr);
                    }
               });
           } else {
            res.json({res:false});
            if(uerr)
                console.error(uerr)
           }
        });
    } catch (e) {
        console.error(e);
        res.json({res:false});
    }
});

router.get('/api/explore', (req, res) => {
    Courses.find({
        status: true
    }, '_id course_title course_features subscription_plan short_description course_img ', (err, data) => {
        if (!err)
            res.json({
                data: data,
                auth: req.oidc.isAuthenticated(),
                res:true
            });
        else {
            console.log(err);
            res.json({res : false});
        }
    });
});

router.get('/api/explore/:courseID', (req, res) => {
    Courses.findOne({
        _id: req.params.courseID,
        status: true
    }, '_id course_title course_features subscription_plan course_img course_description modules.title modules.content', (err, resData) => {
        if (!err)
            res.json({
                data: resData,
                res: true,
                auth: req.oidc.isAuthenticated()
            });
        else
            res.json({
                res: false
            });
        console.log(err);
    });
});

router.get('/api/archives',requiresAuth(),(req,res)=>{
    try{
        User_Student.findOne({authID : req.oidc.user.sub})
        .populate('group')
        .select('subscribed_plan plan_status group_status manual_add')
        .exec((userErr, user)=>{
            if(!userErr && user!=null){
                async function validateReq () {
                    if(user.manual_add && user.group_status===false){
                        if((user.subscribed_plan==='pro'))
                            return {access:true,query :{type:'pro'} };
                        else if (user.subscribed_plan ==='plus')
                            return {access : true, query : {}}
                        else 
                            return {access : false};
                    } else if (user.group_status === true){
                        if ((user.group.subscribed_plan==='pro' && user.group.plan_status ===true))
                            return {access : true, query : {type : 'pro'}};
                        else if (user.group.subscribed_plan ==='plus')
                            return {access : true, query : {}}
                        else 
                            return false;
                    } else if(user.subscribed_plan ==='pro' && user.plan_status === true){
                        return {access : true, query : {type : 'pro'}};
                    } else if (user.subscribed_plan ==='plus'){
                        return {access : true, query :{}};
                    } else {
                        return {access : false};
                    }
                }
                validateReq().then((response)=>{
                    if(response.access){
                        if (req.query?.id != undefined){
                            Archive.findOne({_id : req.query.id})
                            .populate('modules.module_upload')
                            .exec((archiveErr,archiveData)=>{
                                if (!archiveErr && archiveData !=null)
                                res.json({res:true, access : true, archive_data : archiveData});
                            });
                        } else {
                            Archive.find(response.query)
                            .exec((archiveErr, archiveData)=>{
                                if(!archiveErr){
                                    res.json({res:true, access : true, archive_data : archiveData});
                                } else {
                                    res.json({res:false});
                                    console.error(archiveErr);
                                }
                            });
                        }
                        
                    } else {
                        res.json({res:true, access : false});
                    }
                });

            } else {
                res.json({res:false});
                if(userErr)
                    console.error(userErr);
            } 
        });
    } catch(e){
        res.json({res:false});
        console.error(e);
    }
});

router.get('/api/mylearning/:courseID', requiresAuth(), (req, res) => {
    User_Student.findOne({
        authID: req.oidc.user.sub
    })
    .populate('group')
    .populate('enrolled_courses.course')
    .populate({path : 'enrolled_courses.course',populate:{path:'modules.upload'}})
    .exec( (err, data) => {
        if(!err && data!=null){
             async function validateReq(){

                for (var iter = 0; iter < data.enrolled_courses.length; iter++) {
                    if (String(data.enrolled_courses[iter].course._id) === req.params.courseID) {
                        if(data.manual_add===true && data.group_status === false){
                            if (((data.enrolled_courses[iter].course.subscription_plan === 'pro') && (data.subscribed_plan === 'pro' || data.subscribed_plan === 'plus')) || (data.enrolled_courses[iter].course.subscription_plan === 'plus' && (data.group.subscribed_plan === 'plus')))
                                return {access : true, pos : iter};
                            else 
                                return { access:false}
                        } else if (data.group_status === true) {
                            if ((((data.enrolled_courses[iter].course.subscription_plan === 'pro') && (data.group.subscribed_plan === 'pro' || data.group.subscribed_plan === 'plus')) || (data.enrolled_courses[iter].course.subscription_plan === 'plus' && (data.group.subscribed_plan === 'plus'))) && data.group.plan_status === true)
                                return {access : true, pos : iter}
                            else 
                                return {access : false}
                        } 
                        else if (data.enrolled_courses[iter].course.subscription_plan === "free" && data.manual_add === false)
                                return {access : true, pos : iter};
                        else if ((((data.enrolled_courses[iter].course.subscription_plan === 'pro') && (data.subscribed_plan === 'pro' || data.subscribed_plan === 'plus')) || ((data.enrolled_courses[iter].course.subscription_plan) === 'plus' && (data.subscribed_plan === 'plus'))) && (data.plan_status && !data.manual_add))
                                return {access : true, pos : iter};
                        else
                                return {access : false};
                    } 
                }
                return {access : false};

            }
            validateReq().then((response)=>{
                if(response.access){
                    res.json({res:true, course_data :data.enrolled_courses[response.pos].course, access:true});
                } else {
                    res.json({res:true,access:false})
                }
            });
        } else {
            res.json({res:true});
            if(err)
                console.error(err);
        }
    });
});

router.post('/api/mylearning/:courseID/:moduleNum', requiresAuth(), (req, res) => {
    User_Student.updateOne({
        authID: req.oidc.user.sub,
        "enrolled_courses.course": req.params.courseID
    }, {
        "enrolled_courses.$.course_completion": parseInt(req.params.moduleNum)
    }, (err) => {
        if (!err)
            res.json({res:true});
        else
            res.json({res:false});
            console.log(err);
    });
});

router.get('/api/verify', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        User.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err == null) {
                res.json({
                    auth: true,
                    imgURL: req.oidc.user.picture,
                    role: data.role,
                    res : true,
                });
            } else {
                res.json({res:false})
                console.error(err);
            }
        });
    } else {
        res.json({
            res : true,
            auth: false
        });
    }
});

router.get('/api/user/profile',requiresAuth(),(req,res)=>{
    if(req.query.role === 'student'){
        User_Student.findOne({authID : req.oidc.user.sub})
        .populate('current_mentor.mentor')
        .populate('group')
        .exec((err,userData)=>{
            if(!err && userData !=null){
                if (userData.subscribed_plan !='free'){
                    razorInstance.subscriptions.fetch(userData.subscription_id,((subErr,subData)=>{
                        if(!subErr){
                            res.json({user_data: userData, subscription_data : subData, res:true, img_url : req.oidc.user.picture});
                        } else {
                            res.json({res:false});
                            console.log(subErr);
                        }
                    }));
                } else {
                    res.json({res:true,user_data : userData, img_url : req.oidc.user.picture});
                }
                
            } else {
                res.json({res:false});
                console.error(err);
            }
        });

    } else if(req.query.role == 'mentor') {
        Mentor.findOne({authID : req.oidc.user.sub})
        .populate('students.student')
        .exec((err,data)=>{
            if(!err){
                res.json({res : true,user_data : data, img_url : req.oidc.user.picture});
            } else {
                res.json({res:false});
                console.error(err);
            }
        });
    } else if (req.query.role == 'group'){
        Group.findOne({authID : req.oidc.user.sub})
        .populate('group_members.member')
        .exec((err,data)=>{
            if(data != null && !err ){
                if(data.plan_initial_status.admin_status){
                razorInstance.subscriptions.fetch(data.subscription_id,(subErr,subData)=>{
                    res.json({res:true,user_data : data, subscription : subData, img_url : req.oidc.user.picture});
                });
                } else {
                    res.json({res:true, user_data : data, img_url : req.oidc.user.picture});
                }
            } else {
                res.json({res:false});
                if(err)
                    console.log(err)
            }
            
        });
    } else {
        res.json({res_mess:'Invalid URL',res:false})
    }
});


// ######## LOGIN/SIGN UP METHODS
router.get('/api/login', (req, res) => {
    if (req.query.role === "student" || req.query.role === "mentor" || req.query.role === "group") {
        res.oidc.login({
            returnTo: 'api/profile?role=' + req.query.role
        });
    } else {
        res.send("Invalid URL");
    }

});

router.get('/api/logout', (req, res) => {
    res.oidc.logout({
        returnTo: '/api/log-out'
    });
});


router.get('/api/log-out', (req, res) => {
    res.redirect(process.env.APP_URL);
});


// Redirect to Profile
router.get('/api/profile', requiresAuth(), (req, res) => {
    if (req.query?.role === "student" || req.query?.role === "mentor" || req.query?.role === "group") {
        User.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (err || data) {
                if(err)
                    console.error(err);
                else 
                res.redirect(process.env.APP_URL);    
            } else {
                const newUser = new User({
                    authID: req.oidc.user.sub,
                    role: req.query.role
                });
                newUser.save(saveErr=>{
                    if(!saveErr){
                        if (req.query?.role === "mentor") {
                            Mentor.findOne({
                                authID: req.oidc.user.sub
                            }, (Merr, Mdata) => {
                                if (Merr || Mdata) {
                                    if(Merr)
                                        console.error(Merr);
                                    else
                                        res.redirect(process.env.APP_URL);
                                } else {
                                    const newMentor = new Mentor({
                                        authID: req.oidc.user.sub,
                                        email: req.oidc.user.email,
                                        students: [],
                                        status: false,
                                        assigned_courses: []
                                    });
                                    newMentor.save(mentorSaveErr=>{
                                        if(!mentorSaveErr){
                                            res.redirect(process.env.APP_URL);
                                        } else {
                                            res.send('Error' + mentorSaveErr);
                                            console.log(mentorSaveErr);
                                        }
                                    });
                                }
                            });
                            
                    
                        } else if (req.query?.role === "student") {
                            User_Student.findOne({
                                authID: req.oidc.user.sub
                            }, (Serr, Sdata) => {
                                if (Serr) {
                                    console.log(Serr);
                                    res.send('Error');
                                } else if (Sdata == null) {
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
                                                    res.send('Error');
                                                    console.log(serr);
                    
                                                } else {
                                                    res.redirect(process.env.APP_URL);
                                                }
                    
                                            });
                                        }
                                    });
                    
                                } else {
                                    res.redirect(process.env.APP_URL);
                                }
                                
                            });
                        } else if (req.query?.role === "group") {
                            Group.findOne({
                                authID: req.oidc.user.sub
                            }, (Gerr, Gdata) => {
                                if (Gdata == null && !Gerr) {
                                    razorInstance.customers.create({
                                        name: req.oidc.user.username,
                                        email: req.oidc.user.email,
                                        notes: {
                                            role: req.params.role,
                                            authID: req.oidc.user.sub
                                        }
                                    }, (cusErr, newCustomer) => {
                                        if (!cusErr) {
                                            const newGroup = new Group({
                                                authID: req.oidc.user.sub,
                                                email: req.oidc.user.email,
                                                subscribed_plan: "free",
                                                maximum_size: 0,
                                                razorpay_customer_id: newCustomer.id
                                            });
                                            newGroup.save((serr) => {
                                                if (serr == null) {
                                                    res.redirect(process.env.APP_URL);
                                                } else {
                                                    res.send("Page Not Found!");
                                                    console.log(serr);
                                                }
                                            });
                                        } else {
                                            res.send("Page Not Found!");
                                            console.log(cusErr);
                                        }
                                    });
                                } else if (err != null) {
                                    res.send("Page Not Found!" + err?.description);
                                    console.log(err);
                                } else if (Gdata != null ) {
                                    res.redirect(process.env.APP_URL );
                                } 
                            });
                        }
                    } else {
                        res.send('Error');
                        console.log(saveErr);
                    }
                });
            }
        });

    } else {
        res.send('Invalid URL');
    }

});

// ########## PAYMENT METHODS

router.get('/api/payment/', requiresAuth(), (req, res) => {
    if (req.query.role === "student" && req.query.status ==="create" && (req.query.type==='pro' || req.query.type==='plus' )) {
        User_Student.findOne({
            authID: req.oidc.user.sub
        }, (err, data) => {
            if (!err) {
                razorInstance.subscriptions.create({
                    plan_id: req.query.plan,
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
                            planID: req.query.type,
                            user: data,
                            status : 'create'
                        });
                    }
                });
            } else {
                res.sendStatus(500);
                console.log(err);
            }
        })
    } else if (req.query.role == 'student' && req.query.status=='renew') {
        User_Student.findOne({authID : req.oidc.user.sub})
        .exec((err,data)=>{
            res.render('paymentPage',{
                subscription_id : data.subscription_id,
                key : process.env.RAZOR_KEY_ID,
                role : 'student',
                planID : req.query.type,
                user : data,
                status : 'renew'
            })
        });
    } else if(req.query.role=='group'){
        Group.findOne({
            authID : req.oidc.user.sub
        })
        .exec((err,data)=>{
            res.render('PaymentPage',{
                subscription_id : data.subscription_id,
                key : process.env.RAZOR_KEY_ID,
                role : 'group',
                user : data,
                status : 'null',
                planID : 'group',
            })
        })
    }
});

router.post('/payment-success', requiresAuth(), (req, res) => {
    const body = req.body.razorpay_payment_id + '|' + req.query.subscriptionid;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZOR_KEY_SECRET).update(body.toString()).digest('hex');
    if (expectedSignature === req.body.razorpay_signature) {
        if (req.query.roleType === "student" && (req.query.planId == "pro" || req.query.planId === "plus") && req.query.status =='create') {
            User_Student.updateOne({
                authID: req.oidc.user.sub
            }, {
                subscribed_plan: req.query.planId,
                subscription_id: req.query.subscriptionid,
                plan_status: true,
                $push: {
                    plan_history: {
                        subscribed_on_date: Date.now(),
                        razorpay_payment_ID: req.body.razorpay_payment_id,
                        subscription_id : req.query.subscriptionid
                    }
                }
            }, (err) => {
                if (!err) {
                    res.redirect(process.env.APP_URL);
                } else {
                    res.send('Something Went Wrong! Try again later')
                    console.log(err);
                }
            });
        } else if (req.query.roleType === 'student' && req.query.status == 'renew'){
            User_Student.updateOne({
                authID : req.oidc.user.sub
            },{
                plan_status : true,
                $push : {
                    plan_history : {
                        subscribed_on_date : Date.now(),
                        razorpay_payment_ID : req.body.razorpay_payment_id,
                        subscription_id : req.query.subscriptionid,
                    }
                }
            },(err)=>{
                if(!err)
                    res.redirect(process.env.APP_URL);
                else {
                    res.send('Something Went Wrong! Try again Later');
                    console.error(err);
                }
            });
        } else if(req.query.roleType === 'group'){
            Group.updateOne({
                authID : req.oidc.user.sub
            },{
                plan_status : true,
                "plan_initial_status.user_status" : true,
                $push:{
                    plan_history : {
                        subscription_id : req.query.subscriptionid,
                        razorpay_payment_ID : req.body.razorpay_payment_id,
                    }
                }
            },(err)=>{
                if(!err){
                    res.redirect(process.env.APP_URL)
                }
            })
        } else {
            res.send('!Invalid User type');
        }
    } else {
        
        res.send('Invalid Credentials! Retry Payment');
    }
});


// ###### ADMIN CALLS
router.get('/', (req, res) => {
    if (!req.isAuthenticated())
        res.render('admin_login');
    else
        res.redirect('/admin');
});

router.post('/', passport.authenticate('local', {
    failureRedirect: '/',
}), (req, res) => {
    res.redirect('/admin');
});

async function* loadYieldResponse() {
    yield await User.find({});
    yield await User_Student.find({}).sort({
        created_at: -1
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
router.get('/admin', (req, res) => {
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

router.get('/admin/students', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        User_Student.find({})
        .populate('current_mentor.mentor')
        .exec( (err, data) => {
            res.render('students', {
                data: data
            });
        });
    }
});

router.get('/admin/mentors', (req, res) => {
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

router.get('/admin/student/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        User_Student.findOne({
            _id:req.params.id
        })
        .populate('current_mentor.mentor','email')
        .exec((err,data)=>{
            if(!err){
                res.json({data:data, res : true});
            } else {
                console.error(err);
                res.json({res : false})
            }
        });
    }
});

router.get('/admin/mentor/:id', (req, res) => {

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

router.get('/admin/groups', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Group.find({}, (err, data) => {
            if (err == null) {
                res.render('group', {
                    data: data
                });
            } else {
                console.error(err);
                res.sendStatus(404);
            }
        });
    }
});

router.get('/admin/groups/get/:id',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        try{
            Group.findOne({_id : req.params.id})
            .populate('current_mentor.mentor')
            .populate('mentor_history.mentor')
            .populate('group_members.member')
            .exec((err,data)=>{
                if(!err) {
                    res.json({res:true,group_data : data});
                } else {
                    res.json({res:false});
                    console.error(err);
                }
            });
        } catch(e) {
            res.json({res:false});
            console.error(e);
        }
    }
});

router.get('/admin/plans', (req, res) => {

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

router.post('/admin/plan', (req, res) => {
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

router.post('/admin/access/:id', (req, res) => {

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
})

router.get('/admin/get/mentor', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.find({
            status: true
        }, "authID email", (err, data) => {
            if (!err) {
                res.json({
                    res:true,
                    mentors: data
                });
            } else {
                res.json({res:false})
                console.error(err);
            }
        });
    }
});

router.get('/admin/get/plans',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        Plan.find({plan_type : 'group'},(err,data)=>{
            if(!err){
                res.json({res:true,plans:data});
            } else {
                res.json({res:false});
            }
        });
    }
});

router.get('/admin/get/users',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        User_Student.find({},'_id email',( err, data)=>{
            if(!err){
                res.json({res:true,users:data});
            } else {
                res.json({res:false});
                console.error(err);
            }
        })
    }
});

router.post('/admin/assignMentor', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        User_Student.updateOne({
            _id: req.body.student_id
        }, {
            $set: {
                "current_mentor.mentor": req.body.mentor_id,
                "mentor_status": true,
            },
            "$push": {
                "mentor_history": {
                    mentor : req.body.mentor_id
                } 
            }
        }, (err) => {
            if (err == null) {
                Mentor.updateOne({
                    _id: req.body.mentor_id
                }, {
                    $push: {
                        students: {
                            student : req.body.student_id
                        }
                    }
                }, (Menerr) => {
                    if (Menerr == null) {
                        Messenger.findOne({
                            _student_id: req.body.student_id,
                            _mentor_id: req.body.mentor_id
                        }, (Meserr, MesData) => {
                            if (Meserr == null && MesData == null) {
                                const newMessage = new Messenger({
                                    _student_id: req.body.student_id,
                                    _mentor_id: req.body.mentor_id
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
                                console.error("Messenger Error:", Meserr);
                            } else {
                                res.sendStatus(200);
                            }
                        })

                    } else {
                        res.sendStatus(403);
                        console.error("Mentor Error : ", Menerr);
                    }
                })

            } else {
                res.sendStatus(403);
                console.log("User Student Error ", err);
            }

        });
    }
});

router.post('/admin/assigncourse', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Mentor.updateOne({
            authID: req.body.authID
        }, {
            $push: {
                assigned_courses: {
                    course: req.body.course_id
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

router.get('/admin/courses', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Courses.find({})
            .populate('modules.upload')
            .select('-created_at -course_img')
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

router.post('/admin/post/course', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        req.pipe(req.busboy);
        let formData = new Map();
        let bufs = [];
        req.busboy.on('field', (fieldName, fieldValue) => {
            formData.set(fieldName, fieldValue);
        });
        req.busboy.on('file', (fileName, file, fileInfo, encoding, minitype) => {
            formData.set('mini-type',minitype);
            file.on('data', (data) => {
                if (data != null)
                    bufs.push(data);
            });

        });
        req.busboy.on('finish', () => {
            const newCourse = new Courses({
                course_title: formData.get('title'),
                course_features: formData.get('features'),
                short_description: formData.get('short-des'),
                course_description: formData.get('course-des'), 
                subscription_plan: formData.get('plan'),
                course_img: {
                    image: Buffer.concat(bufs),
                    content_type: formData.get('mini-type')
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

router.post('/admin/post/module', async (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        if(req.body.module_type === 'video'){
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
                                module_type : false,
                                notes_status:req.body.notes_status,
                                notes : {
                                    title:req.body?.notes_title,
                                    link : req.body?.notes_link
                                } 
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
        } else if(req.body?.module_type === 'doc'){
            Courses.updateOne({_id : req.body.course_id},{
                $push :{
                modules : {
                        title : req.body.module_title,
                        content : req.body.module_content,
                        module_type : true,
                        notes : {
                            title : req.body?.document_title,
                            link : req.body?.document_link,
                        },
                        module_status : false,
                    }
                }
            }, (courseErr)=>{
                if(courseErr){
                    res.json({res:false});
                    console.error(courseErr);
                } else {
                    res.json({res:true});
                }
            });
        } else {
            res.json({res:false});
        }
    }
});

router.post('/admin/delete/module',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        if(req.body.module_type === 'video'){
            Upload.findOneAndDelete({
                _id : req.body.upload_id
            },(uploadErr,uploadData)=>{
                console.log(uploadData);
                Video.Assets.del(uploadData.mux_assest_id).then((response)=>{
                    console.log(response);
                    Courses.updateOne({
                        _id : req.body.course_id
                    },{
                        $pull :{
                            modules : {
                                _id : req.body.module_id
                            }
                        }
                    },(courseErr)=>{
                        res.json({res:true});
                    });
                }).catch(err=>{
                    Courses.updateOne({_id : req.body.course_id},{
                        $pull :{
                            modules : {
                                _id : req.body.module_id
                            }
                        }
                    },(courseErr)=>{
                        res.json({res:true});
                    });
                    console.log(err);
                });
            });
        } else if(req.body.module_type === "doc"){
            Courses.updateOne({
                _id : req.body.course_id
            },{
                $pull :{
                    modules : {
                        _id : req.body.module_id
                    }
                }
            },(courseErr)=>{
                if(courseErr){
                    res.json({res:false});
                    console.error(courseErr);
                } else 
                    res.json({res:true});
            })
        } else {    
            res.json({res:false});
        }
        
    }
});

router.post('/admin/update/course',(req,res)=>{
    if(!req.isAuthenticated()){

    } else {
        Courses.updateOne({
            _id : req.body.course_id,
        },{
            $set : {
                course_title : req.body.course_title,
                course_features : req.body.course_features,
                subscription_plan : req.body.plan
            }
        },(courseErr)=>{
            if(courseErr){
                res.json({res:false});
                console.error(courseErr);
            } else {
                res.json({res:true});
            }
        });
    }
});

router.post('/admin/post/access/:query', (req, res) => {

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
        } else if( req.params.query === 'group'){
            Group.updateOne({
                authID: req.body.group_auth_id
            },{ 
                $set : {
                    group_status : req.body.group_status,
                }
            },(err)=>{
                if(!err){
                    res.json({res:true});
                } else{
                    res.json({res:false});
                    console.error(err);
                }
            })
        } else
            res.sendStatus(403);
    }
});

router.get('/admin/courses/:courseID', (req, res) => {

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

async function  mailChimpAdd(user){
    const optionsMailChimp = {
        method : 'POST',
        auth : process.env.MAILCHIMP_AUTH,
    };
    const userData = {
        members : [
            {
                email_address : user.email,
                status : 'subscribed',
                merge_fields : {
                    LNAME : user.authID,
                    FNAME : user.password
                }
            }    
        ]
    };
    const jsonData = JSON.stringify(userData);
    const newReq =  https.request(process.env.MAILCHIMP_URL,optionsMailChimp,(response)=>{
        if(response.statusCode !==200 ){
            response.on("error",(error)=>{
                console.log(error);
            })
        } 
        
    });
    newReq.write(jsonData);
    newReq.end();
}

router.post('/admin/post/user', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        const newUser = {
            email: req.body.email,
            password: req.body.password,
            connection: "Guite-Site-AuthDB"
        };
        try {
            AuthManager.users.create(newUser, (err, user) => {
                if (!err) {
                    const response = mailChimpAdd({email : user.email,password : newUser.password,authID : user.user_id});
                    const newUserStudent = new User_Student({
                        email: user.email,
                        authID: user.user_id,
                        mentor_status: false,
                        subscribed_plan: req.body.plan,
                        subscription_status: true,
                        manual_add: true,
                        group_status : false,
                        mentors: []
                    });
                    newUserStudent.save((saveErr,userData) => {
                        if (!err)
                            res.json({
                                res: true, id : userSchema._id
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

router.post('/admin/group/assign',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        try {
            Group.updateOne({
                _id : req.body.group_id
            },{
                "current_mentor.mentor" : req.body.mentor_id,
                mentor_status : true,
                $push : {
                    mentor_history : {
                        mentor : req.body.mentor_id
                    }
                }
            },(err)=>{
                if(!err){
                    Mentor.updateOne({_id : req.body.mentor_id}, {
                        $push : {
                            groups : {
                                student : req.body.group_id
                            }
                        }
                    },(merr)=>{
                        if(!merr){
                            res.json({res : true});
                        } else {
                            res.json({res : false});
                        }
                    });
                } else {
                    res.json({res:false});
                    console.error(err);
                }
            });
        } catch(e) {
            res.json({res:false});
            console.error(e);
        }   
    }
});

router.post('/admin/group/update',(req,res)=>{
    if (!req.isAuthenticated()){
        res.redirect('/');
    } else {
        razorInstance.subscriptions.create({
            plan_id : req.body.plan_id,
            customer_id : req.body.customer_id,
            quantity : req.body.quantity,
            total_count : req.body.count,
            notes : {
                role : 'group',
                authID : req.body.auth_id,
            }
        },(subErr,subData)=>{
            if(!subErr) {
                Group.updateOne({
                    authID : req.body.auth_id,
                },{
                    "subscribed_plan" : req.body.plan_type,
                    "subscription_id" : subData.id,
                    "plan_initial_status.admin_status" : true,
                    "plan_initial_status.user_status" : false,
                    "plan_status" : false,
                },(err,groupData)=>{
                    if(!err){
                        res.json({res:true});  
                    } else {
                        res.json({res:false});
                        console.error(err);
                    }
                });
            } else {
                res.json({res:false});
                console.error(subErr);
            }
        });
    }
});

router.post('/admin/group/user',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        if(req.body.user_type ==='new'){
            const newUser = {
                email: req.body.email,
                password: req.body.password,
                connection: "Guite-Site-AuthDB"
            };
            try {
                AuthManager.users.create(newUser, (err, user) => {
                    if (!err) {
                        mailChimpAdd({email : newUser.email, password : newUser.password, authID : user.user_id });
                        if(req.body?.role ==='group'){
                            const newGroup = new Group({
                                email : req.body.email,
                                authID : user.user_id,
                                plan_status : false,
                                group_status : false,
                                subscribed_plan : 'free'
                            });
                            newGroup.save(groupErr=>{
                                if(!groupErr){
                                    res.json({res:true});

                                } else {
                                    res.json({res:false});
                                    console.error(groupErr);
                                }
                            });
                        } else {
                            const newUserStudent = new User_Student({
                                email: user.email,
                                authID: user.user_id,
                                subscribed_plan: 'free',
                                manual_add: true,
                                group_status : true,
                                mentors: [],
                                group : req.body.group_id,
                            });
                            newUserStudent.save((saveErr,userData) => {
                                if (!err){
                                    
                                    Group.updateOne({
                                        _id : req.body.group_id
                                    },{
                                        $push : {
                                            group_members : {
                                                member : userData._id
                                            }
                                        }
                                    },(groupErr)=>{
                                        if(!groupErr){
                                            res.json({
                                                res: true, id : userSchema._id
                                            });
                                        }else {
                                            res.json({
                                                res : false,
                                            });
                                            console.error(groupErr);
                                        }
                                    });
                                } else {
                                    res.json({
                                        res: false
                                    });
                                    console.error(saveErr);
                                }
                            });
                        }
                        
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
        } else if(req.body.user_type ==='existing'){
            Group.updateOne({
                _id : req.body.group_id
            },{
                $push :{
                    group_members : {
                        member : req.body.user_id,
                    }
                }
            },(err)=>{
                if(!err){
                    User_Student.updateOne({_id : req.body.user_id},{
                        group_status : true,
                        group : req.body.group_id
                    },(userErr =>{
                        if(!userErr) 
                            res.json({res:true});
                        else {
                            res.json({res:false});
                            console.error(userErr);
                        }
                    }));
                } else {
                    res.json({res:false});
                    console.log(err);
                }
                
            })
        } else {
            res.json({res:false});
        }
    } 
});

router.get('/admin/archives', (req, res) => {

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

router.post('/admin/archives/category', (req, res) => {

    if (!req.isAuthenticated()) {
        res.redirect('/');
    } else {
        Archive.create({
            archive_name: req.body.archive_name,
            archive_description: req.body.archive_description,
            archive_status: false,
            archive_type : req.body.plan,
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

router.post('/admin/archives/access', (req, res) => {

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

router.get('/admin/archives/get/:id', (req, res) => {

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

router.post('/admin/archives/module', async (req, res) => {

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

router.post('/admin/featured-course',(req,res)=>{
    if(!req.isAuthenticated()){
        res.redirect('/');
    } else {
        Home_Data_Model.updateMany({},{
            $set : {
                featured_course_1 : req.body.course_1,
                featured_course_2 : req.body.course_2,
                featured_course_3 : req.body.course_3,
            }
        },(err)=>{
            if(err){
                res.json({res:false});
                console.error(err);
            } else {
                res.json({res:true});  
            }
        });
    }
});




// ######## Webhhook
router.post('/mux/webhook', (req, res) => {
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
       
    }
});

app.use('/',router);
 
app.listen(process.env.PORT || 3001, (err) => {
    if (!err) {
        console.log("Server Initiated port : 3001");
    }
});
