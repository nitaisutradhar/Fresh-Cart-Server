const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db("FreshCartDB");
    const usersCollection = db.collection("users");
    const productCollection = db.collection("products");
    const advertisementCollection = db.collection("advertisements");

    const verifyAdmin = async (req, res, next) => {
      const email = req?.user?.email
      const user = await usersCollection.findOne({
        email,
      })
      console.log(user?.role)
      if (!user || user?.role !== 'admin')
        return res
          .status(403)
          .send({ message: 'Admin only Actions!', role: user?.role })

      next()
    }

    const verifyVendor = async (req, res, next) => {
      const email = req?.user?.email;
      const user = await usersCollection.findOne({
        email,
      });
      //console.log(user?.role)
      if (!user || user?.role !== "vendor")
        return res
          .status(403)
          .send({ message: "Vendor only Actions!", role: user?.role });

      next();
    };

    // 🚀 JWT Generate Route
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      });
      res.send({ token, message: "JWT Created Successfully!" });
    });

    // save or update a users info in db
    app.post("/user", async (req, res) => {
      const userData = req.body;
      userData.role = "user"; // default role is user
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      const query = {
        email: userData?.email,
      };
      const alreadyExists = await usersCollection.findOne(query);
      console.log("User already exists: ", !!alreadyExists);
      if (!!alreadyExists) {
        console.log("Updating user data......");
        const result = await usersCollection.updateOne(query, {
          $set: { last_loggedIn: new Date().toISOString() },
        });
        return res.send(result);
      }

      console.log("Creating user data......");
      // return console.log(userData)
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    // get a user's role
    app.get("/user/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      if (!result) return res.status(404).send({ message: "User Not Found." });
      res.send({ role: result?.role });
    });

    // get all users
    app.get("/users", verifyToken , verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Update User Role
    app.patch("/users/:id/role", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.send(result);
    });

    // Vendor Related Endpoints

    // Save product in db
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Get vendor-specific products
    app.get("/products", verifyToken, verifyVendor, async (req, res) => {
      const email = req.query.vendorEmail;
      const result = await productCollection.find({ email: email }).toArray();
      res.send(result);
    });

    // get product by id
    app.get("/products/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // PATCH route to update a product by ID
    app.put("/products/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;

      // ❌ Remove _id if it exists in the payload
      if (updatedProduct._id) {
        delete updatedProduct._id;
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedProduct,
      };

      const result = await productCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Delete a product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // GET /products/public
    app.get("/all-products", async (req, res) => {
      const { sort, startDate, endDate } = req.query;
      const query = {};

      // ✅ Proper Date filtering
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate).toISOString(),
          $lte: new Date(endDate).toISOString(),
        };
      }

      // ✅ Sorting logic (convert price to number)
      const sortStage =
        sort === "lowToHigh"
          ? { $sort: { convertedPrice: 1 } }
          : sort === "highToLow"
          ? { $sort: { convertedPrice: -1 } }
          : { $sort: { date: -1 } }; // default latest

      const pipeline = [
        { $match: query },
        {
          $addFields: {
            convertedPrice: { $toDouble: "$price" },
          },
        },
        sortStage,
        {
          $project: {
            convertedPrice: 0,
          },
        },
      ];

      const products = await productCollection.aggregate(pipeline).toArray();
      res.send(products);
    });

    // Products by admin

    // ✅ Get all products
app.get("/all-products", async (req, res) => {
  const products = await productCollection.find().toArray();
  res.send(products);
});

// ✅ Approve a product
app.patch("/products/approve/:id", async (req, res) => {
  const id = req.params.id;
  const result = await productCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "approved",
        rejectionFeedback: "", // clear rejection if previously rejected
      },
    }
  );
  res.send(result);
});

// ✅ Reject a product with feedback
app.patch("/products/reject/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const { rejectionFeedback } = req.body;
  const result = await productCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "rejected",
        rejectionFeedback,
      },
    }
  );
  res.send(result);
});

    // Advertisement related api

    // Get all advertisements
    app.get("/all-advertisements", async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    });

    // Vendor - Add Advertisement
    app.post("/advertisements", verifyToken, verifyVendor, async (req, res) => {
      try {
        const ad = req.body;

        // Optional validation (you can expand)
        if (!ad?.title || !ad?.description || !ad?.image) {
          return res.status(400).send({ message: "Missing fields" });
        }

        ad.status = "pending";
        ad.created_at = new Date().toISOString();

        const result = await advertisementCollection.insertOne(ad);
        res.send(result);
      } catch (err) {
        console.error("Error saving advertisement:", err.message);
        res.status(500).send({ message: "Failed to save advertisement" });
      }
    });

    // Get All Ads for a Vendor
    app.get(
      "/advertisements/:email",
      verifyToken,
      verifyVendor,
      async (req, res) => {
        const email = req.params.email;
        const ads = await advertisementCollection
          .find({ vendorEmail: email })
          .toArray();
        res.send(ads);
      }
    );
    // Update Advertisement
    app.patch(
      "/advertisements/:id",
      verifyToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        const updatedData = req.body;
        const result = await advertisementCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.send(result);
      }
    );

    // Delete Advertisement
    app.delete(
      "/advertisements/:id",
      verifyToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        const result = await advertisementCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      }
    );

    // end
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("FreshCart server is running 🥦");
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
