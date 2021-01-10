const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const { Consumer } = require("sqs-consumer");
const config = require("./config.json");

AWS.config.update({
  region: config.region,
});

const port = process.argv.slice(2)[0];
const app = express();

const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

app.use(bodyParser.json());

// SNS Publishing
app.post("/send", async (req, res) => {
  const data = {
    email: req.body["email"],
    firstName: req.body["firstName"],
    age: req.body["age"],
  };

  const snsData = {
    Message: JSON.stringify(data),
    MessageAttributes: {
      uniqueSenderID: {
        DataType: "String",
        StringValue: "Microservice3",
      },
      email: {
        DataType: "String",
        StringValue: data.email,
      },
      firstName: {
        DataType: "String",
        StringValue: data.firstName,
      },
      age: {
        DataType: "Number",
        StringValue: data.age,
      },
    },
    MessageDeduplicationId: req.body["email"],
    MessageGroupId: "Microservice3",
    TopicArn: config.topicARN,
  };

  // Publish the data to the SNS queue
  try {
    const publishTextPromise = await sns.publish(snsData).promise();

    console.log(`MicroSVC3 | SUCCESS: ${publishTextPromise.MessageId}`);
    res.send("Thank you for sending data to MicroSVC1 and MicroSVC2.");
  } catch (err) {
    console.log(`MicroSVC3 | ERROR: ${err}`);
    res.send("We ran into an error. Please try again.");
  }
});

// Create our consumer
const sqsConsumer = Consumer.create({
  queueUrl: config.sqsURL,
  handleMessage: async ({ Body }) => {
    const snsMessage = JSON.parse(Body);
    console.log(snsMessage.Message);
  },
  sqs,
});

sqsConsumer.on("error", (err) => {
  console.error(err.message);
});

sqsConsumer.on("processing_error", (err) => {
  console.error(err.message);
});

sqsConsumer.start();

console.log(`Emails service listening on port ${port}`);
app.listen(port);
