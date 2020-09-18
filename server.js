require('dotenv').config()
const polka = require('polka');
const cors = require('cors') 
const { json } = require('body-parser')
const aws = require('aws-sdk')
const { v4: uuidv4 } = require('uuid');//generuje losowe nazwy

const port = 3000

const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    S3_BUCKET_NAME
} = process.env 
//Łaczenie sie z AWS - po stronie serwera wrazliwe dane ukryte przed użytkownikiem
aws.config.setPromisesDependency();
aws.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
    region: 'us-east-1'
}) 
//Inicjalizacja serwera
polka()
.use(cors(), json())
.get('/getPresignedPost', (req, res) => { //Podpisywanie obrazka sygnaturą
    let S3Client = new aws.S3(); 
    let s3params = {//przygotowanie danych
        Bucket: "testowybucket1",
        Fields: {
            key: "images/" + uuidv4(), 
        },
        acl: "bucket-owner-full-control", 
        Conditions: [
            ["content-length-range", 0, 100000000],
            ["starts-with", "$Content-Type", "image/"],
        ],
    }; 
    //przygotowanie danych do wysłania do s3 ; odpowiedz z sygnaturą 
    S3Client.createPresignedPost(s3params, function (err, data) { 
        if (err) {
            res.end(JSON.stringify(err))
        } else {
            res.end(JSON.stringify(data)) 
        }
    })
})
//funkcja odpowiadająca za pobranie obrazków z s3
.get('/listOfObjects', async (req, res) => {
    let S3Client = new aws.S3();
    let response = await S3Client.listObjectsV2({
        Bucket: 'testowybucket1',
    }).promise();
    res.end(JSON.stringify(response))
}) 
//wysyłanie unikalnych nazw obrazków do kolejki SQS
.post('/sendMessages', (req, res) => {
    req.body.forEach(item => {
        (new aws.SQS({apiVersion: '2012-11-05'})).sendMessage({
            // Remove DelaySeconds parameter and value for FIFO queues
            DelaySeconds: 10,
            MessageAttributes: {
                "Key": {
                    DataType: "String",
                    StringValue: item
                },
            },
            MessageBody: item, 
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/205149550397/simplequeue1" //adres kolejki na która sa wysyłane obrazki
        }, function (err, data) {
        });
    });
    res.end()
})


.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
