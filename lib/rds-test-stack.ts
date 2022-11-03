import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DatabaseProxy } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { join } from 'path';

export class RdsTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const existingVpc = Vpc.fromLookup(this, 'Vpc', {
      vpcId: 'vpc-0392d1393b88f7f1e',
    });
    const firstSecurityGroup = SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup1', 'sg-04b4f359f7a8a29c6');
    const secondSecurityGroup = SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup2', 'sg-02d720111f02a97c4');

    const secret = Secret.fromSecretAttributes(this, 'Secret', {
      secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:549672552044:secret:rds-playground-dev-rds-credentials-VFBmfu'
    });

    const nodeProps: NodejsFunctionProps = {
      handler: 'handler',
      vpc: existingVpc,
      securityGroups: [firstSecurityGroup, secondSecurityGroup],
      timeout: Duration.minutes(1),
      environment: {
        PROXY_ENDPOINT: 'rds-playground-dev-proxy.proxy-cgmnu6o6ymux.us-east-1.rds.amazonaws.com',
        RDS_SECRET_NAME: secret.secretName,
      },
      bundling: {
        sourceMap: true,
        minify: false,
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [`cp -R ${inputDir}/lib/AmazonRootCA1.pem ${outputDir}/`];
          },
          beforeInstall() { return []; },
          afterBundling() { return []; },
        },
      },
    };

    const postLmb = new NodejsFunction(this, 'Post', {
      entry: join(__dirname, 'lambda-fns/post.ts'),
      ...nodeProps,
    });
    secret.grantRead(postLmb);

    const getAllLmb = new NodejsFunction(this, 'GetAll', {
      entry: join(__dirname, 'lambda-fns/getAll.ts'),
      ...nodeProps,
    });
    secret.grantRead(getAllLmb);

    const rest = new RestApi(this, 'RestApi');
    const resource = rest.root.addResource('rds');
    resource.addMethod('POST', new LambdaIntegration(postLmb));
    resource.addMethod('GET', new LambdaIntegration(getAllLmb));
  }
}
