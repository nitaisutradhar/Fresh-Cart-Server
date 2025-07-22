const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()
const jwt = require("jsonwebtoken");

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden" });
    }
    req.user = decoded;
    next();
  });
};

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
    //await client.connect();
    // Send a ping to confirm a successful connection
   // await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("FreshCartDB")
    const usersCollection = db.collection("users")
    const productCollection = db.collection("products")

    const verifyVendor = async (req, res, next) => {
      const email = req?.user?.email
      const user = await usersCollection.findOne({
        email,
      })
      console.log(user?.role)
      if (!user || user?.role !== 'vendor')
        return res
          .status(403)
          .send({ message: 'Vendor only Actions!', role: user?.role })

      next()
    }

    // 🚀 JWT Generate Route
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      });
      res.send({ token, message: 'JWT Created Successfully!' });
    });





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
    app.get('/user/role/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({ email })
      if (!result) return res.status(404).send({ message: 'User Not Found.' })
      res.send({ role: result?.role })
    })

    
// Vendor Related Endpoints

  // Save product in db
  app.post("/products", async (req, res) => {
    const product = req.body;
    const result = await productCollection.insertOne(product);
    res.send(result);
  });

  // Get vendor-specific products
  app.get("/products", verifyToken,verifyVendor, async (req, res) => {
    const email = req.query.vendorEmail;
    const result = await productCollection.find({ email: email }).toArray();
    res.send(result);
  });

  // Delete a product
  app.delete("/products/:id", async (req, res) => {
    const id = req.params.id;
    console.log(id)
    const result = await productCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });


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
