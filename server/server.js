const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const {OAuth2Client}=require("google-auth-library");
const path=require("path");

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:"*"}});
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"../client")));
app.get("/health",(req,res)=>res.json({status:"ok",game:"BattleRoyale3D",version:"1.1.0"}));

const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||"";
const FACEBOOK_APP_ID=process.env.FACEBOOK_APP_ID||"";
const FACEBOOK_APP_SECRET=process.env.FACEBOOK_APP_SECRET||"";
const googleClient=new OAuth2Client(GOOGLE_CLIENT_ID||undefined);
app.get("/auth/config",(req,res)=>res.json({googleClientId:GOOGLE_CLIENT_ID,facebookAppId:FACEBOOK_APP_ID}));

async function googleVerify(idToken){
  if(!GOOGLE_CLIENT_ID) throw new Error("Google OAuth is not configured on the server");
  const ticket=await googleClient.verifyIdToken({idToken,audience:GOOGLE_CLIENT_ID});
  const payload=ticket.getPayload();
  if(!payload?.sub) throw new Error("Invalid Google login token");
  return {provider:"google",providerId:String(payload.sub),name:payload.name||payload.email?.split("@")[0]||"Google Player",email:payload.email||null};
}
async function facebookVerify(accessToken){
  if(!FACEBOOK_APP_ID||!FACEBOOK_APP_SECRET) throw new Error("Facebook OAuth is not configured on the server");
  const appAccessToken=`${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
  const u=new URL("https://graph.facebook.com/debug_token");
  u.searchParams.set("input_token",accessToken);u.searchParams.set("access_token",appAccessToken);
  const r=await fetch(u);const data=await r.json();const info=data.data;
  if(!r.ok||!info?.is_valid||String(info.app_id)!==String(FACEBOOK_APP_ID)) throw new Error("Invalid Facebook login token");
  return {provider:"facebook",providerId:String(info.user_id),name:"Facebook Player",email:null};
}
app.post("/auth/google",async(req,res)=>{try{res.json({ok:true,user:await googleVerify(req.body?.credential)});}catch(e){res.status(401).json({ok:false,error:e.message});}});
app.post("/auth/facebook",async(req,res)=>{try{res.json({ok:true,user:await facebookVerify(req.body?.accessToken)});}catch(e){res.status(401).json({ok:false,error:e.message});}});

const players=new Map();
io.on("connection",socket=>{
  players.set(socket.id,{id:socket.id,name:"Player",provider:null,providerId:null,x:0,y:1,z:0,rotationY:0,hp:100});
  socket.emit("welcome",{id:socket.id});io.emit("players",Array.from(players.values()));
  socket.on("playerLogin",data=>{const p=players.get(socket.id);if(!p||!data)return;p.name=String(data.name||"Player").slice(0,16);p.provider=String(data.provider||"").slice(0,20)||null;p.providerId=String(data.providerId||"").slice(0,200)||null;io.emit("players",Array.from(players.values()));});
  socket.on("playerMove",data=>{const p=players.get(socket.id);if(!p||!data)return;if(![data.x,data.y,data.z].every(Number.isFinite))return;if(Math.abs(data.x)>550||Math.abs(data.z)>550)return;p.x=data.x;p.y=data.y;p.z=data.z;if(Number.isFinite(data.rotationY))p.rotationY=data.rotationY;socket.broadcast.emit("playerMoved",p);});
  socket.on("setName",name=>{const p=players.get(socket.id);if(p)p.name=String(name||"Player").slice(0,16);});
  socket.on("disconnect",()=>{players.delete(socket.id);io.emit("playerLeft",socket.id);});
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`BattleRoyale3D running on http://localhost:${PORT}`));
