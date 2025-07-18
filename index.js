const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion } = require("mongodb")
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB connection
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
   // await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("FreshCartDB")
    const usersCollection = db.collection("users")

   // save or update a users info in db
    app.post('/user', async (req, res) => {
      const userData = req.body
      userData.role = 'user' // default role is user
      userData.created_at = new Date().toISOString()
      userData.last_loggedIn = new Date().toISOString()
      const query = {
        email: userData?.email,
      }
      const alreadyExists = await usersCollection.findOne(query)
      console.log('User already exists: ', !!alreadyExists)
      if (!!alreadyExists) {
        console.log('Updating user data......')
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedIn: new Date().toISOString() },
        })
        return res.send(result)
      }

      console.log('Creating user data......')
      // return console.log(userData)
      const result = await usersCollection.insertOne(userData)
      res.send(result)
    })

     // get a user's role
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      if (!result) return res.status(404).send({ message: 'User Not Found.' })
      res.send({ role: result?.role })
    })

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("FreshCart server is running 🥦")
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
