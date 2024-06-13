const express = require('express');
const app = express(); //permet de créer le serveur

const server = require('http').createServer(app);
const path = require('path');
const { Server } = require("socket.io");
const io = new Server(server);

app.use('/bootstrap/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/bootstrap/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use(express.static('public'));

//mise en place du chemin pour l'accès à la page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/index.html'));
});


let rooms = [];

io.on('connection', (socket) => {
    console.log('un joueur est connecté');

    socket.on('playerData', (player) => {
        console.log(`[playerData] ${player.username}`);
    
        let room = null; //Déclaration de la variable 
        
        //Si le joueur n'a pas de salon assigné alors il peut créer un salon
        if (!player.roomId) {
            room = createRoom(player);
            console.log(`[create room ] - ${room.id} - ${player.username}`);
        } else {
            room = rooms.find(r => r.id === player.roomId);
            
            //Si la room est undefined alors on retourne rien
            if (room === undefined) {
                return;
            }
            
            //On attribu l'id de la room au roomId du joueur
            player.roomId = room.id;
            room.players.push(player); //On push player
        }
    
        socket.join(room.id);
    
        io.to(socket.id).emit('join room', room.id); //On envoie le fait de rejoindre une room
    
        //Si le salon a 2 joueur alors on commence le jeu
        if (room.players.length === 2) {
            io.to(room.id).emit('start game', room.players);
        }
    });

    socket.on('get rooms', () => {
        io.to(socket.id).emit('list rooms', rooms);
    });

    socket.on('play', (player) => {
        console.log(`[play] ${player.username}`); //Affiche log pour debuggage 
        io.to(player.roomId).emit('play', player); //On émet un message lançant le jeu
    });

    //Récupération de la demande côté client
    socket.on('play again', (roomId) =>{
        const room = rooms.find(r => r.id === roomId);
        
        //S'il y a un salon et que ce salon contient 2 joueurs 
        if(room && room.players.length === 2){
            //Alors on "autorise" le joueur à relancer le jeu (en émettant 'play again')
            io.to(room.id).emit('play again', room.players);
        }
    });
    
    //On récupère les données lorsque c'est déconnecté
    socket.on('disconnect', () => {
        console.log(`[disconnect], ${socket.id}`);
        let room = null; //Déclaration de la variable room 

        rooms.forEach(r => {
            r.players.forEach(p => {
                if(p.socketId === socket.id && p.host) {
                    room = r;
                    rooms = rooms.filter(r => r !== room);
                }
            });
        });
    });
});

function createRoom(player){
    //Création d'une room à partir d'un id de room généré aléatoirement et de joueurs
    const room = { id: roomId(), players: [] };

    player.roomId = room.id; // On assigne à chaque joueur l'id de la room 
    room.players.push(player); // On push les joueurs dans la room 
    rooms.push(room); // On exporte la room

    return room;
}

function roomId() {
    return Math.random().toString(36).substring(2, 9); //Génère un id unique sur 9 caractères
}

server.listen(3000, () => {
    console.log('listening on port:3000');
}); 