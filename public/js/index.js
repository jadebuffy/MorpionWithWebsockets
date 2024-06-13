//Création d'une classe avec des paramètres pour chaque joueur
const player = {
    host: false,
    playedCell: "",
    roomId: null,
    username: "",
    socketId: "",
    symbol: "",
    turn: false,
    win: false
};

const socket = io();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const roomId = urlParams.get('room');

if (roomId) {
    document.getElementById('start').innerText = "Rejoindre";
}

const usernameInput = document.getElementById('username');

const userCard = document.getElementById('user-card');
const gameCard = document.getElementById('game-card');

const restartArea = document.getElementById('restart');
const waitingArea = document.getElementById('waiting-area');

const roomsCard = document.getElementById('rooms-card');
const roomsList = document.getElementById('rooms-list');

const turnMsg = document.getElementById('turn-message');
const linkToShare = document.getElementById('link-to-share');

let ennemyUsername = "";

socket.emit('get rooms');
socket.on('list rooms', (rooms) => {
    let html ="";

    if(rooms.length > 0) {
        rooms.forEach(room => {
            if(room.players.length !== 2) {
                html += `<li class="list-group-item d-flex justify-content-between">
                            <p class="p-0 m-0 flex-grow-1 fw-bold">Salon de ${room.players[0].username} - ${room.id}</p>
                            <button class="btn btn-sm btn-success join-room" data-room="${room.id}">Rejoindre</button>
                        </li>`;
            }
        });
    }

    if (html !== "") {
        roomsCard.classList.remove('d-none');
        roomsList.innerHTML = html;

        for (const element of document.getElementsByClassName('join-room')) {
            element.addEventListener('click', joinRoom, false)
        }
    }
});

$("#form").on('submit', function (e) {
    e.preventDefault();

    player.username = usernameInput.value;

    // Si on rejoint une roomid, alors on n'est pas l'hôte de la partie
    if (roomId) {
        player.roomId = roomId;
    } else {
        player.host = true; // Le joueur est l'hôte de la partie
        player.symbol = generateRandomSymbol(); // Attribuer le symbole aléatoire
    }

    player.socketId = socket.id;

    userCard.hidden = true; // On cache le formulaire de création de partie
    waitingArea.classList.remove('d-none'); // On enlève la classe qui cache la salle d'attente
    roomsCard.classList.add('d-none'); // On cache la liste des parties en cours

    socket.emit('playerData', player);
});

$(".cell").on("click", function (e) {

    const playedCell = this.getAttribute('id');

    if (this.innerText === "" && player.turn) {
        player.playedCell = playedCell;

        this.innerText = player.symbol;

        player.win = calculateWin(playedCell);
        player.turn = false; //A la fin de son tour, ce n'est plus son tour de jouer

        socket.emit('play', player);
    }
});

$("#restart").on("click", function () {
    restartGame(); //dès qu'on clique sur le bouton qui comporte cet id alors on enclenche restart
});

socket.on('join room', (roomId) => {
    player.roomId = roomId;
    linkToShare.innerHTML = `<a href="${window.location.href}?room=${player.roomId}" target="_blank">${window.location.href}?room=${player.roomId}</a>`;
});

socket.on('start game', (players) => {
    startGame(players);
});

socket.on('play', (ennemyPlayer) => {

    if (ennemyPlayer.socketId !== player.socketId && !ennemyPlayer.turn) {
        // On récupère les cellules jouées par l'adversaire
        const playedCell = document.getElementById(`${ennemyPlayer.playedCell}`);

        //on assigne la cellule jouée au symbole de l'adversaire
        playedCell.classList.add('text-warning');
        playedCell.innerHTML = ennemyPlayer.symbol;

        //Si le joueur adverse gagne alors ...
        if (ennemyPlayer.win) {
            //On envoie un message pour dire que nous avons perdu
            setTurnMessage('alert-info', 'alert-danger', `C'est perdu ! <b>${ennemyPlayer.username}</b> a gagné !`);
            // On calcule si l'ennemi a gagné
            calculateWin(ennemyPlayer.playedCell);
            showRestartArea();
            return;
        }

        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            showRestartArea();
            return;
        }

        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
        player.turn = true; //C'est à l'autre joueur de jouer
        
    } else {
        if (player.win) {
            $("#turn-message").addClass('alert-success').html("Félicitations, tu as gagné la partie !");
            showRestartArea();
            return;
        }

        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            showRestartArea();
            return;
        }

        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`)
        player.turn = false; //Ce n'est plus le tour du joueur
    }
});

socket.on('play again', (players) => {
    restartGame(players);
});


function startGame(players) {
    restartArea.classList.add('d-none');
    waitingArea.classList.add('d-none');
    gameCard.classList.remove('d-none');
    turnMsg.classList.remove('d-none');

    const ennemyPlayer = players.find(p => p.socketId !== player.socketId);
    ennemyUsername = ennemyPlayer.username;

    // Assigner le symbole uniquement si le joueur n'est pas l'hôte
    if (!player.host) {
        player.symbol = generateRandomSymbol(ennemyPlayer.symbol);
        player.turn = randomTurn(ennemyPlayer.turn) === 1;
    } else {
        // L'hôte ne joue pas en premier, choisissez l'autre joueur
        player.turn = false;
    }

    //Si c'est notre tour alors on envoie un message lui disant que c'est au joueur de jouer sinon ce n'est pas son tour
    if (player.turn) {
        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
    } else {
        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`);
    }
}

function restartGame(players = null) {
    const ennemyPlayer = players ? players.find(p => p.socketId !== player.socketId) : null;
    ennemyUsername = ennemyPlayer ? ennemyPlayer.username : "";

    if (player.host && !players) {
        socket.emit('play again', player.roomId);
    }

    const cells = document.getElementsByClassName('cell'); //je récupère les cellules depuis le document html

    for (const cell of cells) {
        cell.innerHTML = '';
        cell.classList.remove('win-cell', 'text-warning');
    }

    // Assigner le symbole uniquement si le joueur n'est pas l'hôte
    if (!player.host) {
        player.symbol = generateRandomSymbol(ennemyPlayer.symbol); //on génère un symbole en prenant en compte le symbole du joueur adverse
        player.turn = randomTurn() === 1; //Le tour est défini aléatoirement
    } else {
        // L'hôte ne joue pas en premier, choisissez l'autre joueur
        player.turn = false;
    }

    
    //Si c'est notre tour alors on envoie un message lui disant que c'est au joueur de jouer sinon ce n'est pas son tour
    if (player.turn) {
        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
    } else {
        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`);
    }

    turnMsg.classList.remove('alert-warning', 'alert-danger'); //On enlève le message

    //Remets à 0 la section win
    player.win = false;

    //S'il y a des joueurs alors on peut commencer une partie avec les joueurs
    if (players) {
        startGame(players);
    }
}

//Afficher le bouton rejouer
function showRestartArea(){
    if (player.host) {
        //Seulement si le joueur est l'hôte, il peut rejouer
        restartArea.classList.remove('d-none');
    }
}

//Fonction permettant de changer le message affiché au dessus du plateau de jeu
function setTurnMessage(classToRemove, classToAdd, html){
    turnMsg.classList.remove(classToRemove);
    turnMsg.classList.add(classToAdd);
    turnMsg.innerHTML = html;
}

//Fonction permettant de calculer s'il y a une égalité 
function calculateEquality(){
    let equality = true;
    const cells = document.getElementsByClassName('cell'); //on récupère les serres par leur id dans le fichier html

    for (const cell of cells){
        if(cell.textContent === ''){
            equality = false;
        }
    }
    return equality;
}

//Fonction permettant de calculer si un joueur à gagner à partir des cellules jouées et du symbol des participants
function calculateWin(playedCell, symbol = player.symbol){
    let row = playedCell[5]; //Nombre de lignes 
    let column = playedCell[7]; //Nombre de colonnes

    let win = true; //on défini win 

    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${column}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${column}`).addClass("win-cell");
        }

        return win;
    }

    win = true;
    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${row}-${i}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${row}-${i}`).addClass("win-cell");
        }

        return win;
    }

    win = true;

    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${i}`).text() !== symbol) {
            win = false;
        }
    }

    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${i}`).addClass("win-cell");
        }

        return win;
    }

    win = false;
    if ($("#cell-1-3").text() === symbol) {
        if ($("#cell-2-2").text() === symbol) {
            if ($("#cell-3-1").text() === symbol) {
                win = true;

                $("#cell-1-3").addClass("win-cell");
                $("#cell-2-2").addClass("win-cell");
                $("#cell-3-1").addClass("win-cell");

                return win;
            }
        }
    }
}

//Permet de définir aléatoirement le joueur qui jouera en premier
function randomTurn() {
    return Math.random() < 0.5 ? 1 : 2; // formule 50% de chance pour le joueur 1, 50% de chance pour le joueur 2
}

//Fonction qui permet de générer aléatoirement un symbole 
function generateRandomSymbol(playerSymbol) {
    const symbols = ['X', 'O']; //Définition des symboles possible

    if (playerSymbol) {
        // Si le symbole du joueur est fourni, attribuer l'autre symbole à l'adversaire
        return symbols.find(symbol => symbol !== playerSymbol);
    } else {
        // Si aucun symbole n'est fourni, attribuer un symbole au hasard
        return symbols[Math.floor(Math.random() * symbols.length)];
    }
}

const joinRoom = function () {
    //Si le joueur a rentré une valeur (si le champs n'est pas vide)
    if (usernameInput.value !== "") {
        //alors j'attribue les différents champs à ceux d'un player
        player.username = usernameInput.value;
        player.socketId = socket.id;
        player.roomId = this.dataset.room;

        //Je renvoie au serveur les données
        socket.emit('playerData', player);

        userCard.hidden = true; //Je cache la carte qui correspond à userCard
        waitingArea.classList.remove('d-none'); //J'enlève la carte waitingArea
        roomsCard.classList.add('d-none'); //J'enlève la liste des salons disponibles
    }
}
