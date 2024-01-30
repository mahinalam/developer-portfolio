const express = require('express')
// const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.Payment_Secret_Gateway)


//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        };
        req.decoded = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DBUser}:${process.env.DBPass}@cluster0.zzcfrzy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menuCollection = client.db("bistroBoss").collection('menu')
        const userCollection = client.db("bistroBoss").collection('users')
        const cartCollection = client.db("bistroBoss").collection('carts')
        const reviewCollection = client.db("bistroBoss").collection('reviews')
        const paymentCollection = client.db("bistroBoss").collection('payments')
        const bookingCollection = client.db("bistroBoss").collection('bookings')



        //verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next()
        }

        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ token })
        })


        //user related info
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })


        app.patch('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        //check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.params.email;
            if (email !== decodedEmail) {
                return res.send({ admin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            if (user?.role === 'admin') {
                return res.send({ admin: true })
            }
            else {
                res.send({ admin: false })
            }

        })

        app.delete('/users/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await userCollection.deleteOne(filter)
            res.send(result)
        })

        //menu related info
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray()
            res.send(result)
        });


        app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollection.insertOne(menu)
            res.send(result)

        });


        app.put('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const menu = req.body;
            console.log(id);
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: menu
            }

            const result = await menuCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })


        app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)

        })

        //cart related info
        app.get('/carts', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email
            if (!email) {
                return res.send([])
            }
            if(decodedEmail !== email){
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()

            res.send(result)
        })
        app.post('/carts', verifyJWT, async (req, res) => {
            const cart = req.body;
            const result = await cartCollection.insertOne(cart)
            res.send(result)
        })



        app.delete('/carts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            console.log(result)
            res.send(result)
        })



        //booking related api

        app.get('/bookings', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await bookingCollection.find().toArray()
            res.send(result)
        })


        app.get('/user-bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const filter = { email: email }

            const result = await bookingCollection.find(filter).toArray()
            res.send(result)
        })

        app.post('/bookings', verifyJWT, async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking)
            console.log(booking);
            res.send(result)
        })


        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status
                }
            }

            const result = await bookingCollection.updateOne(query, updateDoc)
            res.send(result)
        })


        app.delete('/bookings/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log('id is', id)
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
            res.send(result)
        })


        //review related info
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray()
            res.send(result)
        });

        app.post('/reviews', verifyJWT, async (req, res) => {
            const review = req.body;
            console.log(review);
            const result = await reviewCollection.insertOne(review)
            res.send(result)
        })


        //create payment intent
        // app.post('/create-payment-intent', async (req, res) => {
        //     const { price } = req.body;
        //     console.log(price)
        //     const amount = parseFloat(price) * 100;
        //     console.log(amount)
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: amount,
        //         currency: 'usd',
        //         payment_method_types: ['card']
        //     })

        //     res.send({
        //         clientSecret: paymentIntent.client_secret
        //     })

        // })
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        //payment related api


        app.get('/payments', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find().toArray()
            res.send(result)
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const insertedResult = await paymentCollection.insertOne(payment)

            const query = { _id: { $in: payment.cartItemsId.map(id => new ObjectId(id)) } }
            const deletedResult = await cartCollection.deleteMany(query)
            res.send({ insertedResult, deletedResult })
        })
        app.post('/payments/bookings', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const result = await paymentCollection.insertOne(payment)
            res.send(result)
        })

        app.get('/payments/user', verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email;
            console.log(email, decodedEmail);
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'unauthorized access' })
            }
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })

        //adminb stat
        app.get('/admin-stat', verifyJWT, verifyAdmin, async (req, res) => {
            const customers = await userCollection.estimatedDocumentCount()
            const products = await menuCollection.estimatedDocumentCount()
            const price = await paymentCollection.find().toArray()
            const revenue = parseFloat(price.reduce((sum, item) => sum + item.price, 0).toFixed(2))
            console.log(typeof (revenue), revenue);

            const orders = await paymentCollection.estimatedDocumentCount()
            res.send({ customers, products, revenue, orders })
        });


        app.get('/user-stat', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: 'unauthorized access' })
            }
            const filter = { email: email }
            const payments = await paymentCollection.find(filter).toArray()
            const orders = payments.filter(payment => payment.category === 'Food Order')
            const bookings = payments.filter(payment => payment.category === 'book table')
            const reviews = await reviewCollection.find(filter).toArray()
            const totalPayments = payments.length;
            const menu = await menuCollection.find().toArray()
            const menuItems = await menuCollection.estimatedDocumentCount()
            const salads = menu.filter(item => item.category === 'salad')
            const soups = menu.filter(item => item.category === 'soup')
            const pizzas = menu.filter(item => item.category === 'pizza')
            const drinks = menu.filter(item => item.category === 'drinks')
            const desserts = menu.filter(item => item.category === 'dessert')
            const foodOrder = parseInt(salads.length + soups.length + pizzas.length + drinks.length + desserts.length)
            console.log({ orders, bookings, reviews, totalPayments,foodOrder,menuItems });
            res.send({ orders, bookings, reviews, totalPayments, menuItems, foodOrder })
        })


        //get order stat
        // app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {
        //     const pipeline = [
        //         {
        //             $lookup: {
        //                 from: 'menu',
        //                 localField: 'menuItems',
        //                 foreignField: '_id',
        //                 as: 'menuItemsData'
        //             }
        //         },
        //         {
        //             $unwind: '$menuItemsData'
        //         },
        //         {
        //             $group: {
        //                 _id: '$menuItemsData.category',
        //                 count: { $sum: 1 },
        //                 total: { $sum: '$menuItemsData.price' }
        //             }
        //         },
        //         {
        //             $project: {
        //                 category: '$_id',
        //                 count: 1,
        //                 total: { $round: ['$total', 2] },
        //                 _id: 0
        //             }
        //         }
        //     ];

        //     const result = await paymentCollection.aggregate(pipeline).toArray()
        //     res.send(result)

        // })

        // app.get('/order-stats',  async (req, res) => {
        //     const pipeline = [
        //         {
        //             $lookup: {
        //                 from: 'menu',
        //                 localField: 'menuItemsId',
        //                 foreignField: '_id',
        //                 as: 'menuItems',
        //             }
        //         },
        //         {
        //             $unwind: '$menuItems',
        //         },
        //         {
        //             $group: {
        //                 _id: '$menuItems.category',
        //                 itemCount: { $sum: 1 },
        //                 totalPrice: { $sum: '$menuItems.price' },
        //             }
        //         },
        //         {
        //             $project: {
        //               category: '$_id',
        //               itemCount: 1,
        //               total: { $round: ['$totalPrice', 2] },
        //               _id: 0
        //             }
        //           }
        //     ];

        //     const result = await paymentCollection.aggregate(pipeline).toArray()
        //     console.log(result)
        //     res.send(result)
        // })

        app.get('/order-stats', async (req, res) => {
            const pipeline = [
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemsId',
                        foreignField: '_id',
                        as: 'menuItemsData'
                    }
                },
                {
                    $unwind: '$menuItemsData'
                },
                {
                    $group: {
                        _id: '$menuItemsData.category',
                        count: { $sum: 1 },
                        total: { $sum: '$menuItemsData.price' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        count: 1,
                        total: { $round: ['$total', 2] },
                        _id: 0
                    }
                }
            ];

            const result = await paymentCollection.aggregate(pipeline).toArray()
            console.log(result);
            res.send(result)

        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('bistro boss running')
})
app.listen(port, () => {
    console.log(`Bistro boss is sitting on port ${port}`);
})