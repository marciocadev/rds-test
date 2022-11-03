import 'source-map-support/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueCommandInput } from '@aws-sdk/client-secrets-manager';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createConnection } from 'mysql';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

export const handler = async(event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  console.log('request: ', JSON.stringify(event, undefined, 2));
  console.log(`Getting secret for ${process.env.RDS_SECRET_NAME}`);

  const body = JSON.parse(event.body!);

  const input: GetSecretValueCommandInput = {
    SecretId: process.env.RDS_SECRET_NAME,
  };
  const response = await client.send(new GetSecretValueCommand(input));
  const { username, password } = JSON.parse(response.SecretString!);
  console.log(username);
  console.log(password);
  console.log(JSON.parse(response.SecretString!));

  var connection = createConnection({
    host: process.env.PROXY_ENDPOINT,
    user: username,
    password: password,
    database: 'cdkpatterns',
    ssl: {
      ca: readFileSync(join(__dirname, 'AmazonRootCA1.pem')),
    },
  });

  // This may be our first time running this function, setup a MySQL Database
  const createResult = await new Promise( (resolve, _) => {
    connection.query('SELECT * FROM rds_proxy', function (error:any, results:any, fields:any) {
      if (error) throw error;
      // connected!
      let tableString:{[key: string]: string}[] = [];
      for (let value of results) {
        tableString.push({
          id: value.id,
          txt: value.txt
        })
      }

      resolve(tableString);
    });
  }).catch((error)=>{
    return JSON.stringify(error);
  });

  connection.destroy();

  return {
    body: JSON.stringify(createResult),
    statusCode: 200,
  };
};