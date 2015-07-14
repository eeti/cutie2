// Cutie 0.1.0
// Copyright (C) 2015 Sweeti Alexandra

// For use with node-steam >= 1.0.0-rc
// Use with any other/earlier versions will NOT work. At all. Don't try it. You will be disappointed, I promise.

// Internal function helpers
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

// String helpers
helper.startsWith = function(s1, s2){
	return s1.substring(0,s2.length) == s2;
}

// This used to come standard in the bot.users array. Whatevs.
var myFriends = [];

helper.updateFriends = function(evt){
	var found = false;
	
	myFriends.forEach(function(v,k){
		if( v.friendid == evt.friendid ) { // found a match!
			found=true;
			myFriends[k] = evt;
		}
	});
	
	if( ! found ) myFriends.push(evt); // add the user to the end of the array if we didn't find them
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

// Helper function to find a friend by name.
helper.findFriendsByName = function(name){
	var friends = [];
	
	myFriends.forEach(function(v,k){
		if( v.player_name.toLowerCase().indexOf(name.toLowerCase()) > -1 ){
			friends.push(v);
		}
	});
	
	return friends;
}

// Helper function/vars for /quiet
var quiet = [];

// Returns true if the person was quieted and false if they were unquieted.
helper.quiet = function(id){
	// This only changes when we add/remove to it, so we'll read it in every time we plan to modify it
	quiet = JSON.parse(fs.readFileSync("quiet.cached"));
	
	// Find our target. /quiet toggles it on/off.
	var f = false;
	var g = true;
	quiet.forEach(function(v,k){
		if( v.id == id ){
			v.quieted=!v.quieted;
			f=true;
			g=v.quieted;
		}
	});
	
	// We didn't find it, add them to the end of the array
	if( ! f ){
		quiet.push({id: id, quieted: true});
		g=true;
	}
	
	// Save our changes
	fs.writeFileSync("quiet.cached", JSON.stringify(quiet));
	
	// Return our result
	return g;
}

// Pretty self-explanatory.
helper.isQuieted = function(id){
	var m = false;
	quiet.forEach(function(v,k){
		if( v.id == id ) m=v.quieted;
	});
	return m;
}

// Broadcast message helper
helper.broadcast = function(id, msg){
	// Go through each friend and if they're not /quiet-ed, send them the broadcasted message
	myFriends.forEach(function(v,k){
		if( ! helper.isQuieted(v.friendid) && v.friendid != id ) friends.sendMessage(v.friendid, msg);
	});
}

// Helper function for welcoming users
helper.welcome = function(id){
	H.reply(id, "Welcome to Cutie! To chat with the other users currently using Cutie, just type. To stop receiving messages, type /quiet. For more information, type /help.");
}

// Helper function for antispam
var lastMessage = {};
var offenses = {};
helper.antispam = function(id){
	
	if( ! lastMessage.hasOwnProperty(id) || ! offenses.hasOwnProperty(id) ){
		lastMessage[id] = Date.now();
		offenses[id] = 0;
		return false;
	}
	else {
		if( Date.now()-lastMessage[id] < 400 ){
			if( offenses[id] > 3 ){
				helper.quiet(id);
				H.reply(id, "You've been force-quieted for spamming. To unquiet, type /quiet.");
				lastMessage[id] = Date.now();
				offenses[id]=0;
				return true;
			}
			else {
				H.reply(id, "Please don't spam.");
				lastMessage[id] = Date.now();
				offenses[id]+=1;
				return true;
			}
		}
		else {
			lastMessage[id] = Date.now();
			return false;
		}
	}
	
}

// Helper functions for notes
var notes = {};
helper.savenotes = function(){
	fs.writeFileSync("notes.cached", JSON.stringify(notes));
}
helper.loadnotes = function(){
	if( ! fs.existsSync("notes.cached") ) helper.savenotes();
	else notes=JSON.parse(fs.readFileSync("notes.cached"));
}
helper.takenote = function(name, contents, id){
	helper.loadnotes();
	
	if( notes.hasOwnProperty(name) ){
		if( id != notes[name].owner ) return H.reply(id, "Error: you are not the owner of " + name);
		notes[name].contents = contents;
		return H.reply(id, "Note updated.");
	}
	
	notes[name] = {
		contents: contents,
		owner: id
	}
	
	helper.savenotes();
	
	H.reply(id, "Note saved.");
}
helper.delnote = function(id, name){
	helper.loadnotes();
	
	if( notes.hasOwnProperty(name) && id == notes[name].owner ){
		delete notes[name];
		return H.reply(id, "Note deleted.");
	}
	else return H.reply(id, "You are not the owner of that note, or it doesn't exist.")
}

// Helper function for the below
helper.syntaxAndExit = function(err){
	console.log("cutie: " + err);
	console.log(process.argv[0] + " " + process.argv[1] + " account_name password [auth_code]");
	process.exit(1);
}

// H is a shorthand for helper
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
		
		// Read our /quiet stuff (or create it if it doesn't exist)
		if( ! fs.existsSync("quiet.cached") ) fs.writeFileSync("quiet.cached", JSON.stringify([]));
		else quiet=JSON.parse(fs.readFileSync("quiet.cached"));
		
		// Go online and change/set my name
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

// This used to come standard
friends.on('personaState', function(e){
	if( client.steamID == e.friendid ) return;
	H.debug("Recieved a profile update for " + e.friendid + "!");
	
	// Hacky way to accept requests on-the-fly. TODO: find a better way
	if( ! "persona_state" in e ){
		friends.addFriend(e.friendid);
		H.info("Added friend " + e.friendid);
		H.welcome(e.friendid);
	}

	H.updateFriends(e);
});

// -- Here's where the actual bot part begins --

// Commands. An object so it's extensible.
var commands = {};

commands.about = {};
commands.about.description = "Get information about Cutie.";
commands.about.run = function(s, args){
	H.reply(s, "This is Cutie 0.0.1.");
}

commands.quiet = {};
commands.quiet.description = "Silence Cutie for a while."
commands.quiet.run = function(s, args){
	if( helper.quiet(s) ) H.reply(s, "You're no longer receiving group chats. Type /quiet to receive chats again.");
	else H.reply(s, "You're now receiving group chats. Type /quiet to stop receiving chats.");
}

commands.help = {};
commands.help.description = "Get help with Cutie.";
commands.help.run = function(s, args){
	var commandsList = "";
	for( var f in commands ){
		commandsList+="/" + f + " - " + commands[f].description + "\n";
	}
	
	H.reply(s, "Hey there! I'm Cutie, an autonomous groupchat bot. Besides just typing to chat with the others currently using Cutie, you can use the following commands:\n\n" + commandsList);
}

commands.me = {};
commands.me.description = "Do something";
commands.me.run = function(s, args){
	if( args.length < 2 ) return H.reply(s, "Provide an action, eg /me eats a sandwich");
	H.broadcast(0, "* " + H.findFriend(s).player_name + " " + args.slice(1).join(" "));
}

commands.note = {};
commands.note.description = "Take a note. /note [NAME] [MESSAGE]";
commands.note.run = function(s, args){
	if( args.length < 2 ){
		return H.reply(s, "I have " + Object.keys(notes).length + " notes saved. Use /notes list to see their names.");
	}
	else if( args.length < 3 ){
		if( args[1] == "list" ) return H.reply(s, "Notes saved: " + Object.keys(notes) );
		else if( notes.hasOwnProperty(args[1]) ) return H.reply(s, "Note " + args[1] + " by " + H.findFriend(notes[args[1]].owner).player_name + ": " + notes[args[1]].contents);
		else return H.reply(s, "I don't have a note named that.");
	}
	else {
		if( args[1] == "del" ) return H.delnote(s, args[2]);
		helper.takenote(args[1], args.slice(2).join(" "), s);
	}
}

commands.pm = {};
commands.pm.description = "Send a private message. /pm [NAME] [MESSAGE]";
commands.pm.run = function(s,args){
	if( args.length < 3 ) return H.reply(s, "Not enough arguments: /pm [PARTOFNAME] [MESSAGE]");
	
	var friends = H.findFriendsByName(args[1]);
	
	if( friends.length == 0 ) return H.reply(s, "No people found with that name.");
	
	var msg = args.slice(2).join(" ");
	
	friends.forEach(function(v,k){
		H.reply(v.friendid, "PM: " + H.findFriend(s).player_name + " -> me: " + msg);
	});
	
	var friendstring = "";

	friends.forEach(function(v,k){
		friendstring += v.player_name;
		if( k < friends.length-1 ) friendstring+=", ";
	});
	
	H.reply(s, "PM: me -> " + friendstring + ": " + msg);
}

// Message handler
friends.on('message', function(s,m){
	if( H.isQuieted(s) && m != "/quiet" && m != "" ) return H.reply(s, "You can't speak because you're quieted. Type /quiet to speak.");
	
	if( m == "" ) return H.info(H.findFriend(s).player_name + " is typing...");
	
	if( H.antispam(s) ) m="[spam] " + m;
	H.info(H.findFriend(s).player_name + ": " + m);
	
	if( H.startsWith(m, "[spam] ") ) return;
	
	// Execute commands
	if( H.startsWith(m, "/") ){
		var m2 = m.substring(1).split(" ");
		if( commands[m2[0]] && commands[m2[0]].hasOwnProperty("run") ){
			return commands[m2[0]].run(s, m2);
		}
		else {
			return H.reply(s, "Invalid command.");
		}
	}
	else{
		H.broadcast(s, H.findFriend(s).player_name + ": " + m);
	}
});

// Friend request handler. Auto-accept requests by default.
friends.on('relationships', function(){
	for( var friend in friends.friends ){
		if( friends.friends[friend] == Steam.EFriendRelationship.RequestRecipient ){
			friends.addFriend(friend);
			H.info("Added " + friend);
			H.welcome(friend);
		}
	}
});

// Load notes
H.loadnotes();