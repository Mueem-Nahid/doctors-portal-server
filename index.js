const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');

const port = process.env.port || 5000;

//doctors-portal-mueem-firebase-adminsdk-4qgs1-08033e8a4a.json
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.seewk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//func to verify token
async function verifyToken (req, res, next) {
  if(req.headers?.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch {

    }
  }
  next();
} 

async function run() {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentCollection = database.collection('appointments');
        const userCollection = database.collection('users');

        app.get('/appointments', verifyToken, async (req, res) => {
          const email = req.query.email;
          const date = req.query.date;
          const query = {email: email, date: date};
          const cursor = appointmentCollection.find(query);
          const appointments = await cursor.toArray();
          res.json(appointments);
        });

        app.post('/appointments', async (req, res) => {
          const appointment = req.body;
          const result = await appointmentCollection.insertOne(appointment);
          res.json(result);
        });

        app.get('/users/:email', async (req, res) => {
          const email = req.params.email;
          const query = {email: email};
          const user = await userCollection.findOne(query);
          let isAdmin = false;
          if(user?.role === 'admin') {
            isAdmin = true;
          }
          res.json( {admin: isAdmin} );
        })

        app.post('/users', async (req, res) => {
          const user = req.body;
          const result = await userCollection.insertOne(user);
          res.json(result);
        });

        app.put('/users', async (req, res) => {
          const user = req.body;
          const filter = {email: user.email};
          const options = {upsert: true};
          const updateDoc = {$set: user};
          const result = await userCollection.updateOne(filter, updateDoc, options);
          res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
          const user = req.body;
          //console.log('decoded Email', req.decodedEmail);

          const requester = req.decodedEmail;
          if(requester) {
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin') {
              const filter = {email: user.email};
              const updateDoc = {$set: {role: 'admin'}};
              const result = await userCollection.updateOne(filter, updateDoc);
              res.json(result);
            } else {
              req.status(403).json({message: 'You can not make others as admin'});
            }
          }
        })
    }
    finally {
        //await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Doctors Portal running')
})

app.listen(port, () => {
  console.log(`Server running at ${port}`);
})