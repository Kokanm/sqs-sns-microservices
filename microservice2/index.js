const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
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
        StringValue: "Microservice2",
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
    MessageGroupId: "Microservice2",
    TopicArn: config.topicARN,
  };

  // Publish the data to the SNS queue
  try {
    const publishTextPromise = await sns.publish(snsData).promise();

    console.log(`MicroSVC2 | SUCCESS: ${publishTextPromise.MessageId}`);
    res.send("Thank you for sending data to MicroSVC1 and MicroSVC3.");
  } catch (err) {
    console.log(`MicroSVC2 | ERROR: ${err}`);
    res.send("We ran into an error. Please try again.");
  }
});

// SQS Subscription
const sqsParams = {
  AttributeNames: ["SentTimestamp"],
  MaxNumberOfMessages: 10,
  MessageAttributeNames: ["All"],
  QueueUrl: config.sqsURL,
  VisibilityTimeout: 20,
  WaitTimeSeconds: 10,
};

(function consumeMessages() {
  sqs.receiveMessage(sqsParams, function (err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      const { Body } = data.Messages[0];
      const snsMessage = JSON.parse(Body);
      console.log(snsMessage.Message);

      const deleteParams = {
        QueueUrl: config.sqsURL,
        ReceiptHandle: data.Messages[0].ReceiptHandle,
      };

      sqs.deleteMessage(deleteParams, function (err, data) {
        if (err) {
          console.log("Delete Error", err);
        } else {
          console.log("Message Deleted", data);
        }
      });
    }

    consumeMessages();
  });
})();

console.log(`Orders service listening on port ${port}`);
app.listen(port);
