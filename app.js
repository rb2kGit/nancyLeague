const express = require("express");
const expressHB = require("express-handlebars");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const session = require("client-sessions");
const randomstr = require("randomstring");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = "mongodb+srv://root:rootpass1@cluster0-vvrxr.mongodb.net/test?retryWrites=true&w=majority"


//Connect to the databse.
MongoClient.connect(mongoURL, (err, client) => {
    if(err){
        console.log("Error connecting to the database.");
        throw err;
    }
    console.log("Database connection successful.");


    const app = express();
    const database = client.db("nancyLeague");
    
    app.engine("handlebars", expressHB({defaultLayout: 'default'}));
    app.set("view engine", "handlebars");
    app.use(express.static(path.join(__dirname,'/public')))
    app.use(bodyParser.urlencoded({extended:false}));
    app.use(bodyParser.json());
    app.use(cookieParser());
    
    //Session Middleware
    let randomSecret = randomstr.generate();
    app.use(session({
        cookieName: "userSession",
        secret: randomSecret,
        duration: 30 * 60 * 1000,
        activeDuration: 5 * 60 * 1000,
        httpOnly: true,
        secure: true,
        ephemeral: true
    }))

    //User message variables
    let userMessage = {
        errorMessage: ""
    }
    
    //Stat calculation functions.
    function winCalc(userData, opponentData, e4Data){
        var pointAward = 100;

        userData.matchesPlayed += 1;
        userData.wins += 1;
        userData.winStreak += 1;
        userData.lossStreak = 0;
        userData.lossStacks = 0;
        userData.prevOpp = opponentData.screenName;
        
        //Point modifiers.
        if(opponentData.screenName == userData.prevOpp){
            pointAward = 50;
            userData.points += pointAward;
        }
        else if(opponentData.screenName == e4Players[0].alpha)
        {
            pointAward += 250;
            userData.points += pointAward;
        }
        else if(opponentData.screenName == e4Data[0].beta)
        {
            pointAward += 200;
            userData.points += pointAward;
        }
        else if(opponentData.screenName == e4Data[0].delta)
        {
            pointAward += 150;
            userData.points += pointAward;
        }
        else if(opponentData.screenName == e4Data[0].omega)
        {
            pointAward += 100;
            userData.points += pointAward;
        }
        else{
            userData.points += pointAward;
        }
        
        //Win Ratio calculator.
        if(userData.losses == 0.0){
            userData.winRatio = userData.wins
        }
        else{
            userData.winRatio = userData.wins / userData.losses
        }
        
        
        return userData;
    }

    function lossCalc(opponentData){
        var pointAward = 200;

        opponentData.matchesPlayed += 1;
        opponentData.losses += 1;


        if(opponentData.wins == 0){
            opponentData.winRatio = 0.0;
        }
        else{
            opponentData.winRatio = opponentData.wins / opponentData.losses
        }

        opponentData.winStreak = 0;
        opponentData.lossStreak += 1;
        
        if(opponentData.lossStacks < 5){
            opponentData.lossStacks += 1;
        }

        opponentData.points += (pointAward * (1 + (0.10 * opponentData.lossStacks)));
        
        return opponentData;
    }

    //Routes
    //Gets.
    app.get("/", (req, res) => {
        if(!req.userSession.user){
            req.userSession.user = "unknown";
            res.redirect("login");
        }
        else if(req.userSession.user == "unknown"){
            res.redirect("login");
        }
        else{
            res.redirect("main");
        }
    })
    
    app.get("/login", (req, res) => {
        if(!req.userSession.user){
            req.userSession.user = "unknown";
            res.render("login", {
                userMessage});
        }
        else if(req.userSession.user == "unknown"){
            res.render("login", {
                userMessage});
        }
        else{
            res.redirect("main");
        }
    })

    app.get("/logout", (req, res) => {
        if(!req.userSession.user){
            req.userSession.user = "unknown";
            userMessage.errorMessage = "";
            res.redirect("login");
        }
        else if(req.userSession.user == "unknown"){
            userMessage.errorMessage = "";
            res.redirect("login");
        }
        else{
            userMessage.errorMessage = "";
            res.redirect("main");
        }
    })

    app.get("/main", (req, res) => {
        if(!req.userSession.user){
            userMessage.errorMessage = "";
            res.redirect("login");
        }
        else if(req.userSession.user == "unknown"){
            userMessage.errorMessage = "";
            res.redirect("login");
        }
        else{
            userMessage.errorMessage = "";

            database.collection("userTest").find({ userName: { $exists: true } }).toArray((err, data) => {
                if (err) throw err;
                databaseObject = data;

                databaseObject.sort(function (a, b) {
                    { return b.winRatio - a.winRatio };
                })

                database.collection("e4").find({}).toArray((err, data) => {
                    if (err) throw err;

                    //Elite 4 data initializations.
                    e4Data = data;
                    e4Alpha = databaseObject.find(user => user.screenName == e4Data[0].alpha);
                    e4Beta = databaseObject.find(user => user.screenName == e4Data[0].beta);
                    e4Delta = databaseObject.find(user => user.screenName == e4Data[0].delta);
                    e4Omega = databaseObject.find(user => user.screenName == e4Data[0].omega);

                    var e4Object = {
                        alpha: e4Alpha,
                        beta: e4Beta,
                        delta: e4Delta,
                        omega: e4Omega
                    }

                    database.collection("userTest").find({ $and: [{ userName: { $exists: true } }, { userName: { $ne: req.userSession.user } }] }).toArray((err, data) => {
                        if (err) throw err;
    
                        playerlistObject = data;
    
                        database.collection("userTest").find({ userName: { $eq: req.userSession.user } }).toArray((err, data) => {
                            if (err) throw err;
    
                            userData = data.find(user => user.userName === req.userSession.user);
                            topPlayer = databaseObject[0];
    
                            res.render("main", {
                                userData, databaseObject, playerlistObject, e4Object
                            })
                        });
                    })
                })
            })
        }
    })

    app.get("/winner", (req, res) =>{
        if(!req.userSession.user){
            userMessage.errorMessage = "";
            res.redirect("/login");
        }
        else if(req.userSession.user == "unknown"){
            userMessage.errorMessage = "";
            res.redirect("/login");
        }
        else{
            userMessage.errorMessage = "";
            //Retrieve user data from the database.
            database.collection("userTest").find({userName: {$exists: true}}).toArray((err, data) => {
                if(err) throw err;
                
                databaseObject = data;
                userData = data.find(user => user.userName === req.userSession.user);
                
                res.render("winner", {
                   databaseObject, userData
                })
            })
        }
    })

    app.get("/cashin", (req, res) => {
        if(!req.userSession.user){
            userMessage.errorMessage = "";
            res.redirect("/login");
        }
        else if(req.userSession.user == "unknown"){
            userMessage.errorMessage = "";
            res.redirect("/login");
        }
        else{
            res.redirect("/main");
        }
    })
        
    //Posts
    app.post("/main", (req, res) => {
        //Check if there are valid inputs
        if(req.body.usernameInput && req.body.passwordInput){

            //Initialize user data variables.
            var nameInput = req.body.usernameInput.toLowerCase();
            var passInput = req.body.passwordInput.toLowerCase();

            
            //Retrieve user data from the database.
            database.collection("userTest").find({userName: {$exists: true}}).toArray((err, data) => {
                if(err) throw err;
                
                userData = data.find(user => user.userName === nameInput);

                //Check to see if it found the user.
                if(userData){  
                    if(userData.userName && nameInput == userData.userName && passInput == userData.password){
                        userMessage.errorMessage = "";
                        //Initialize cookie
                        req.userSession.user = nameInput;
    
                        res.redirect("main");                      
                    }
                    //If the username is not correct
                    else if(userData.userName && nameInput != userData.userName || passInput != userData.password){
                        userMessage.errorMessage = "Please enter a valid user name or password.";
                        res.redirect("login");
                    }
                    //If the userdata wasnt found.
                    else if(!userData.userName){
                        userMessage.errorMessage = "Please enter a valid user name or password.";
                        res.redirect("login");
                    }
                    //If all else fails.
                    else{
                        res.redirect("login");
                    }
                }
                else{
                    userMessage.errorMessage = "Please eneter a valid user name or password DAG.";
                    res.redirect("login");
                }

            })
        }
        else{
            userMessage.errorMessage = "Please enter a valid input for both user name and password.";

            res.redirect("login");
        }
    })

    app.post("/logout", (req, res) => {
        userMessage.errorMessage = "";
        req.userSession.destroy();
        res.redirect("/login");
    })

    app.post("/winner", (req, res) =>{
        
        if(!req.userSession.user){
            userMessage.errorMessage = "";
            res.redirect("/login");
        }
        else if(req.body.playerDrop && req.body.matchAmount){
            userMessage.errorMessage = "";
            var matchAmount = req.body.matchAmount;

            //Retrieve user data database.
            database.collection("userTest").find({}).toArray((err, data) => {
                if(err) throw err;
                playerData = data;
                userData = data.find(user => user.userName === req.userSession.user);
                opponentData = data.find(opponent => opponent.userName === req.body.playerDrop);

                database.collection("e4").find({}).toArray((err, data) => {
                    if(err) throw err;
                    
                    //Elite 4 data initializations.
                    var alphaPlayer, betaPlayer, deltaPlayer, omegaPlayer; 
                    e4Players = data;

                    //Player stat Calculations.
                    for(var i = 0; i < matchAmount; i++){
                        winCalc(userData, opponentData, e4Players);
                        lossCalc(opponentData);
                    }    

                    
                    playerData.sort(function(a, b) {
                        {return b.winRatio - a.winRatio};
                    })

                    alphaPlayer = playerData[0].screenName;
                    betaPlayer = playerData[1].screenName;
                    deltaPlayer = playerData[2].screenName;
                    omegaPlayer = playerData[3]. screenName;
                    
                    //Set users new stats.
                    database.collection("userTest").findOneAndUpdate(
                        {userName : userData.userName},
                        {$set: {matchesPlayed: userData.matchesPlayed, 
                            wins : userData.wins,
                            losses: userData.losses,
                            winStreak: userData.winStreak,
                            lossStreak: userData.lossStreak,
                            lossStacks: userData.lossStacks,
                            winRatio: userData.winRatio.toFixed(2),
                            points: userData.points,
                            prevOpp: userData.prevOpp}},
                        {returnOriginal: false},
                        (err, result) => {
                            if(err) throw err;
                        }
                    )
    
                    //Set opponent's new stats.
                    database.collection("userTest").findOneAndUpdate(
                        {userName : {$eq: opponentData.userName}},
                        {$set: {matchesPlayed: opponentData.matchesPlayed, 
                            wins : opponentData.wins,
                            losses: opponentData.losses,
                            winStreak: opponentData.winStreak,
                            lossStreak: opponentData.lossStreak,
                            lossStacks: opponentData.lossStacks,
                            winRatio: opponentData.winRatio.toFixed(2),
                            points: opponentData.points}},
                        {returnOriginal: false},
                        (err, result) => {
                            if(err) throw err;
                        }
                    )

                    //Set elite 4 data.
                    database.collection("e4").findOneAndUpdate(
                        {name : "e4"},
                        {$set: {alpha: alphaPlayer,
                            beta: betaPlayer,
                            delta: deltaPlayer,
                            omega: omegaPlayer}},
                        {returnOriginal: false},
                        (err, result) => {
                            if(err) throw err;
                        }
                    )
                })          
                res.redirect("main");
            })
        }
        else{
            userMessage.errorMessage = "";
            res.redirect("main")
        }
    })
    
    app.post("/cashin", (req, res) => {
        if(!req.userSession.user || req.userSession.user == "unknown"){
            req.userSession.user = "unknown";
            userMessage.errorMessage = "";
            req.redirect("login");
        }
        else{
            database.collection("userTest").find({username: req.userSession.user}).toArray((err, data) => {
                userMessage.errorMessage = "";
                var userdata = data;
                var packNumber = req.body.packNumber;
                costTotal = 100 * packNumber;

                if(userData.points < costTotal){
                    res.redirect("/main");
                }
                else{
                    userData.points -= costTotal;
                    
                    database.collection("userTest").findOneAndUpdate(
                        {userName: req.userSession.user},
                        {$set: {points : userData.points}}, {returnOriginal : false}, (err, result) => {
                            if(err) throw err;
                        }
                    )

                    res.redirect("/main");
                }
            })
        }
    })
    
    //ports
    const httpPort = process.env.PORT || 3000;
    app.listen(httpPort, () => {
        console.log(`Listening on port ${httpPort}`);
    })

})