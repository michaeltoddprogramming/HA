const express = require('express');
const expressLayouts = require('express-ejs-layouts')
const bodyParser = require('body-parser');

const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();

const server = createServer(app);
const io = new Server(server);

const port = process.argv[2] || 3000;

app.use(express.static('public'));
app.use(expressLayouts);

app.use(bodyParser.urlencoded({ extended: true }));

const socketUserMap = {};


app.set('view engine', "ejs");
app.set('layout', './layouts/main');

function makePostRequest(data) {
    const username = 'u23540223';
    const password = 'Michael53816!@';
    const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64');

    return fetch('https://wheatley.cs.up.ac.za/u23540223/api.php', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Authorization': `Basic ${base64Credentials}`,
            'Content-Type': 'application/json'
        }
    })
    .then((response) => response.json())
    .catch(error => console.error('Error:', error));
}


app.get('/auction/create', (req, res) => {
    res.render("auction_create", {title: "Create Auction"});
});

app.post('/auction/create', async (req, res) => {
    const data = {
        "type": "CreateAuction",
        "apikey": "b818d425b255818cb575fe5f59751cbec6e92c610681161671f2c73de84c8b",
        "auctionName": req.body.auctionName,
        "startDate": req.body.startDate,
        "endDate": req.body.endDate,
        "listingDetails": {
            "title": req.body.title,
            "price": req.body.price,
            "location": req.body.location,
            "bedrooms": req.body.bedrooms,
            "bathrooms": req.body.bathrooms,
            "parkingSpaces": req.body.parkingSpaces,
            "amenities": req.body.amenities,
            "shortDescription": req.body.shortDescription,
            "image": req.body.image
        },
        "imageURL": req.body.image
    }
    try {
        await makePostRequest(data);
        res.redirect('/');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred while creating the auction.');
    }
});

app.get('/auction/:id', (req, res) => {
    console.log(req.params.id);
    const options = {
        "type" : "GetAuction",
        "id": req.params.id,
        "apikey": "0d0323aa6873ae8ba8941b573848982f8b0aab0310201f1e15519308943c88ef",
        "return": ["*"]
    }

    makePostRequest(options).then(auction => {
        res.render('auction', {title: "Auction View", auctions: auction['data'], id: req.params.id});
    });
});
function place_bid(auction_id, user_id, amount) {
    const data = {
        "type" : "UpdateAuction",
        "apikey": "0d0323aa6873ae8ba8941b573848982f8b0aab0310201f1e15519308943c88ef",
        "id": auction_id,
        "state": "ONGOING",
        "buyer": user_id,
        "highest_bid": amount
    }
    
    return makePostRequest(data);
}

app.get('/login', (req, res) => {
    const loginData = {
        "type": "Login",
        "email": req.body.email,
        "password": req.body.password
    };

    makePostRequest(loginData)
        .then((response) => {
            if (response.success) {
                res.redirect('/');
            } else {
                res.render('login', { title: "Login", error: response.message });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            res.render('login', { title: "Login", error: `An error occurred while logging in: ${error.message}` });
        });
});

app.get(['/', '/index'], (req, res) => {
    const options = {
        "type" : "GetAuction",
        "apikey": "0d0323aa6873ae8ba8941b573848982f8b0aab0310201f1e15519308943c88ef",
        "return": ["*"]
    }

    makePostRequest(options).then(auctions => {
        res.render('index', {title: "Home", auctions: auctions['data']});
    });
});

io.on('connection', (socket) => {
    console.log('Socket with id: ', socket.id, ' has been OPENED!');
    
    function list() {
        console.log('----------');
        console.log("LISTING ALL CONNECTIONS:");
        for (const curr_socket of io.sockets.sockets.values()) {
            console.log(`Socket(id:${curr_socket.id}) has username: ${socketUserMap[curr_socket.id]}`);
        }
        console.log('----------');
    }
    
    socket.on('disconnect', () => {
        console.log('Socket with id: ', socket.id, ' has been CLOSED!');
    });
    
    socket.on('logout', (username) => {
        delete socketUserMap[username];
        console.log(username, ' has logged out!');
    });
    
    socket.on('join', (username) => {
        console.log(username, ' has logged in!');
        
        socketUserMap[socket.id] = username;
        list();
    });

    socket.on('bid', (data) => {
        let auction_id = data['id'];
        let amount = data['amount'];
        let user_id = data['user_id'];
        
        place_bid(auction_id, user_id, amount).then((response) => {
            socket.emit('bid_response', response);
        });

    });

    socket.on('quit', (data) => {

        socket.broadcast.emit('disconnect', data);
    });

    socket.on('update_state', (data)=> {
        const options = {
            "type" : "UpdateAuction",
            "apikey": "0d0323aa6873ae8ba8941b573848982f8b0aab0310201f1e15519308943c88ef",
            "id" : data['id'],
            "state" : data['state'],
            "buyer": data['buyer'],
            "highestBid": data['highestBid'],
        }
    

        makePostRequest(options).then((response) => {
            console.log("Updated auction state: ", response, data);
        });
    });
});

server.listen(port, () => {
  console.log('server running at http://localhost:3000');
});