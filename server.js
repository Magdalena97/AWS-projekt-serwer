//importy bibliotek
require('dotenv').config()//bibioteka ktora umozliwia mi sciaganie zmiennych z pliku .env potrzebuje je by zalogowac sie do AWS
const polka = require('polka');//nazwa mojego serwera ten serwer odpowida mi na zapytania http
const cors = require('cors') //reguly ktory pozwalaja na wysylanie zapytan htto do innegio serwera, Potrzbe zeby apkiacja laczyła sie z serweram
const { json } = require('body-parser')//serwer ma oslugiwac komunikaje  json
const aws = require('aws-sdk')//bibiloteka aws by lazyc sie z aws
const { v4: uuidv4 } = require('uuid');//generuje losowe nazwy-nazwy plikow generowac losowe

const port = 3000//moja aplkiacja bedzie dzialac na porcie 3000

//importowanie tych 4 zmiennych z pliku aws
const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    S3_BUCKET_NAME
} = process.env
//laczenie  aws to musi byc po strobnie serwrewaj bo to musi byc ukryte przed uzytkownikiem.  dlaczego nie koglam tego uzyc w aplkiacji vue js
aws.config.setPromisesDependency();
aws.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
    region: 'us-east-1'
})
//inicjujmey serwer i nakazuemy jej zeby uzywała corsow i json 
polka()
.use(cors(), json())
.get('/getPresignedPost', (req, res) => { //kiedy zapytam serwer z portu 3000 to zwracam
    let S3Client = new aws.S3(); //inicjuemy klienta s3 obiekt obslugujacy s3
    let s3params = {//przygotowanie danych
        Bucket: "testowybucket1",
        Fields: {
            key: "images/" + uuidv4(), //ma trafuic do katalogi images + looswe nazwe gdzie ten obrazek ma sie znajodwa
        },
        acl: "bucket-owner-full-control", //uprawnienia dostep ze wlasciciel backietu ma tełna kontrole
        Conditions: [//z dokumentacji
            ["content-length-range", 0, 100000000],
            ["starts-with", "$Content-Type", "image/"],/// bedziemy uploadowac obrazki a nie nic innego
        ],
    };
    S3Client.createPresignedPost(s3params, function (err, data) { //biore te dane i daje s3 i podpisz mi to ; przygotuj dane post do wysłania tego pliku
        if (err) {
            res.end(JSON.stringify(err))
        } else {
            res.end(JSON.stringify(data))//funkcja zwracajaca dane .Do serera trafiaja dane i serwer mi odpowiada. To jego odpiweddz data- to mohe podpisane dane 
        }
    })
})
//poberamy obrazki z s3
.get('/listOfObjects', async (req, res) => {
    let S3Client = new aws.S3();
    let response = await S3Client.listObjectsV2({//pobiera liste plikow z s3
        Bucket: 'testowybucket1',
    }).promise();
    res.end(JSON.stringify(response))
})
//wysylanie obrazkow do kolejki regbody tam jest lista obazkow a poneiwz moze byc wiele orazkow to jets forach serwer 
//bierze liste i w petli kazdy key obrazka wsyła do kolejjki sqs 
.post('/sendMessages', (req, res) => {
    req.body.forEach(item => {
        (new aws.SQS({apiVersion: '2012-11-05'})).sendMessage({
            // Remove DelaySeconds parameter and value for FIFO queues
            DelaySeconds: 10,
            MessageAttributes: {
                "Key": {
                    DataType: "String",
                    StringValue: item/// to jest w key czyli w tym sco wysyłamy 
                    //do koljki to sa te ranodmowe liczby kazdy obzem ma scieke ktora jest jednoczenie jego unikalnym indentyfikatorem
                },
            },
            MessageBody: item, 
            // MessageDeduplicationId: "TheWhistler",  // Required for FIFO queues
            // MessageGroupId: "Group1",  // Required for FIFO queues
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/205149550397/simplequeue1" //to jets kolejka jej adres
        }, function (err, data) {
            // res.end(JSON.stringify(data))
        });
    });
    res.end()
})


.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
