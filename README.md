# cutie2
The second version of the Cutie Steam groupchat bot.

## Installing
You **must** be using node-steam >=1.0.0-rc. Try using an older version and you will be
violently yelled at. Literally. Not joking.

```
git clone https://github.com/eeti/cutie2
git clone https://github.com/seishun/node-steam node_modules/steam
cd node_modules/steam
npm install # You must have subversion installed and in your PATH
cd ../../cutie2
node index.js account_name password # Steamguard code will be sent
node index.js account_name password auth_code # Sentry file should be saved at this point
```