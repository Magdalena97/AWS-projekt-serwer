const { Consumer } = require('sqs-consumer');
const AWS = require('aws-sdk');
const Jimp = require("jimp");//bibioyeka zajmujaca sie przetwarzaniem obarzkow
require('dotenv').config()
//zeby miec dostep
const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    S3_BUCKET_NAME
} = process.env

AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
    region: 'us-east-1'
})

const bucketName = S3_BUCKET_NAME;

const s3bucket = new AWS.S3();
//funcja przetwarzajaca obrazek z neta 
const processImage = async (source, logoFile, logoMarginPercentage) => {
    const [image, logo] = await Promise.all([
        Jimp.read(source),
        Jimp.read(logoFile)
    ]).catch((e) => console.log(e));

    logo.resize(image.bitmap.width / 10, Jimp.AUTO);

    let xMargin = (image.bitmap.width * logoMarginPercentage) / 100;
    let yMargin = (image.bitmap.width * logoMarginPercentage) / 100;

    let X = image.bitmap.width - logo.bitmap.width - xMargin;
    let Y = image.bitmap.height - logo.bitmap.height - yMargin;

    let img = image.composite(logo, X, Y, [{
        mode: Jimp.BLEND_SCREEN,
        opacitySource: 0.1,
        opacityDest: 1
    }]);
    return img.getBufferAsync(Jimp.AUTO);//zwracam przetwrzony obrazek
};
  //ggotowa biblioteka-consumer zaczynam monitorowac kolejke
  const app = Consumer.create({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/205149550397/simplequeue1', // nazwa koejki
      handleMessage: async (message) => {//jak cos przyjdzie do kolejke odbieranie wiadimosci z kolejki
          console.log(message)
          let source = 'https://' + bucketName + '.s3.amazonaws.com/' + message.Body;//towzre sobie url mojego obrazek bo zaraz bede
          // robila na nim operacje message.body ->unikalny indentyfikator images /ranodowe jak odpale ten adres w przegladarce to bede widziala moj obrzek
          let watermark = 'https://www.vnaya.com/eonline/images/aws_logo_largerfile.png'; // cos trzeba zrobix z tym obrazkiem i ja robie znak wodny
          processImage(source, watermark, 20).then(image => {//przetwarznia obazka i jak skonczy sie przetwarzac obrazek to then
              let params = {//ladyjemy przrtwprzony obrazek do sq
                  Bucket: bucketName,
                  Key: message.Body + '-watermark',
                  Body: image,
                  ContentType: image.mimetype,
                  ACL: 'public-read'
              };
              s3bucket.upload(params, async (err, data) => {
                  if (err) {
                      console.log(err)
                  } else {
                      console.log(data)
                  }
              });
          });
      },
      sqs: new AWS.SQS()
  });

app.on('error', (err) => {
  console.error(err.message);
});

app.on('processing_error', (err) => {
  console.error(err.message);
});

app.on('timeout_error', (err) => {
 console.error(err.message);
});

app.start();