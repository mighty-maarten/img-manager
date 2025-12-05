# # IMG Manager Client Infrastructure
## Setup
### Prerequisites
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) + [configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html#cli-configure-quickstart-config)
- Set up H-AWS correctly using the ``haws chcp`` command and applying the stored default profile
- [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/cli.html)

### Dependencies
`npm install`


## Development
### Deploy infrastructure

1. Make changes to the infrastructure code files
2. Start haws command execution

```sh
haws execute-command
```
3. Specify the profile to use:

`mighty`

4. Specify the command to deploy the modified stacks using the CDK:

`cdk deploy --all`

5. Push code changes to GitHub

### Destroy infrastructure

1. Start haws command execution

```sh
haws execute-command
```
2. Specify the profile to use:

`mighty`

3. Specify the  command to deploy the modified stacks using the CDK:

`cdk destroy --all`