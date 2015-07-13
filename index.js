// Cutie 0.1.0
// Copyright (C) 2015 Sweeti Alexandra

// For use with node-steam >= 1.0.0-rc
// Use with any other/earlier versions will NOT work. At all. Don't try it. You will be disappointed, I promise.

// Internal function helper
var helper = {};

// Logging helper
helper.info = function(msg){
	console.log("[info] " + msg);
}

helper.debug = function(msg){
	console.log("[debug] " + msg);
}

helper.warn = function(msg){
	console.log("[warn] " + msg);
}

helper.fatal = function(msg){
	console.log("[fatal] " + msg);
	process.exit(1);
}

helper.reply = function(s, m){
	friends.sendMessage(s, m);
}

helper.startsWith = function(s1, s2){
	return s1.substring(0,s2.length) == s2;
}

var myFriends = [];

// This used to come standard in the bot.users array. Whatevs.
helper.updateFriends = function(evt){
	var found = false;
	
	myFriends.forEach(function(v,k){
		if( v.friendid == evt.friendid ) { // found a match!
			found=true;
			myFriends[k] = evt;
		}
	});
	
	if( ! found ) myFriends.push(evt);
}

// Helper function to find a friend by steamid.
helper.findFriend = function(id){
	var i = -1;
	
	myFriends.forEach(function(v,k){
		if( v.friendid == id ) i=k;
	});
	
	if( i > -1 ) return myFriends[i];
	else return null;
}

// Helper function for the below
helper.syntaxAndExit = function(err){
	console.log("cutie: " + err);
	console.log(process.argv[0] + " " + process.argv[1] + " account_name password [auth_code]");
	process.exit(1);
}

var H = helper;

// Make sure we have the correct number of arguments
if( process.argv.length < 3 ) helper.syntaxAndExit("too few arguments");

// Include node-steam and FS
var fs = require("fs");
var Steam = require("steam");

// Use cached server list if possible
if( fs.existsSync("servers.cached") ) Steam.servers = JSON.parse(fs.readFileSync("servers.cached"));

// Init our client, user, and Friends
var client = new Steam.SteamClient();
var user = new Steam.SteamUser(client);
var friends = new Steam.SteamFriends(client);

// Connect to Steam
client.connect();

// Authenticate with Steam
client.on('connected', function(){
	
	H.info("Connected to Steam");
	
	// Initialize a login object
	var obj = {
		account_name: process.argv[2],
		password: process.argv[3]
	};
	
	// Use a sentry file, if we have one
	if( fs.existsSync("sentry.cached") ) obj.sha_sentryfile = fs.readFileSync("sentry.cached");
	
	// Use an auth/steamguard code, if provided
	if( process.argv.length > 3 ) obj.auth_code = process.argv[4];
	
	user.logOn(obj);
});

client.on('logOnResponse', function(r){
	// Did everything go OK?
	if( r.eresult == Steam.EResult.OK ){
		H.info("Logged on");
		friends.setPersonaState(Steam.EPersonaState.Online);
		friends.setPersonaName("Cutie");
	}
	
	// Something bad happened
	else {
		var error = "error " + r.eresult;
		if( r.eresult == Steam.EResult.AccountLogonDenied ) error = "steamguard enabled; code sent to sent to an address at " + r.email_domain;
		if( r.eresult == Steam.EResult.InvalidLoginAuthCode ) error = "steamguard enabled; invalid code; to request one do not provide any code";
		H.fatal("Could not log on to Steam: " + error);
	}
	
});

// Save the new server list we got from Steam, the bootstrapped version is probably stale
client.on('servers', function(s){
	H.info("Saved new server list as servers.cached");
	fs.writeFileSync("servers.cached", JSON.stringify(s));
});

// Save sentry file
user.on('updateMachineAuth', function(s, c){
	fs.writeFileSync("sentry.cached", s.bytes);
	H.info("Saved sentry file as sentry.cached");
	
	// Accept the assigned sentry, this took a while to figure out, and I don't know why, but it works
	// Skipping this step causes Steam auth servers to reject the sentry file we just wrote
	c({
		filename: s.filename,
		eresult: Steam.EResult.OK,
		filesize: 0,
		sha_file: s.bytes,
		offset: 0
	});
});

// Here's where the actual bot part begins

// Commands. An object so it's extensible.
var commands = {};

commands.about = function(s, args){
	H.reply(s, "This is Cutie 0.0.1.");
}

// Message handler
friends.on('message', function(s,m){
	// General logging stuff
	if( m == "" ) return H.info(H.findFriend(s).player_name + " is typing...");
	
	H.info(H.findFriend(s).player_name + ": " + m);
	
	// Execute commands (they start with /)
	if( H.startsWith(m, "/") ){
		var m2 = m.substring(1).split(" ");
		if( commands[m2[0]] ){
			commands[m2[0]](s, m2);
		}
		else {
			H.reply(s, "Invalid command.");
		}
	}
	// Broadcast to everyone
	else {
		// TODO: implement group chatting (lol)
	}
	
});

// This used to come standard
friends.on('personaState', function(e){
	if( client.steamID == e.friendid ) return;
	H.debug("Recieved a profile update for " + e.friendid + "!");
	H.updateFriends(e);
});