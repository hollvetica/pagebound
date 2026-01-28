// Migration Script: Add userId to existing users
// This script adds the Cognito userId (sub) to all existing user profiles

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const ddbClient = new DynamoDBClient({ region: 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-2' });

const USER_POOL_ID = 'us-east-2_qPCehehzb';
const USERS_TABLE = 'pagebound-users';

async function getUserIdFromCognito(email) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    });
    const response = await cognitoClient.send(command);

    // Find the 'sub' attribute (this is the userId)
    const subAttr = response.UserAttributes.find(attr => attr.Name === 'sub');
    return subAttr ? subAttr.Value : null;
  } catch (error) {
    console.error(`Error getting userId for ${email}:`, error.message);
    return null;
  }
}

async function migrateUsers() {
  console.log('========================================');
  console.log('User Migration Script');
  console.log('Adding userId to existing user profiles');
  console.log('========================================\n');

  // Scan all users
  const scanCommand = new ScanCommand({
    TableName: USERS_TABLE
  });

  const result = await docClient.send(scanCommand);
  const users = result.Items || [];

  console.log(`Found ${users.length} users to process\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const user of users) {
    console.log(`\nProcessing: ${user.email}`);

    if (user.userId) {
      console.log(`  ✓ Already has userId: ${user.userId}`);
      skippedCount++;
      continue;
    }

    console.log(`  → Fetching userId from Cognito...`);
    const userId = await getUserIdFromCognito(user.email);

    if (!userId) {
      console.error(`  ✗ Could not get userId for ${user.email}`);
      errorCount++;
      continue;
    }

    console.log(`  → Found userId: ${userId}`);

    // Update the user record with userId and new fields
    try {
      const updateCommand = new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { email: user.email },
        UpdateExpression: 'SET userId = :userId, displayName = :displayName, isPrivate = :isPrivate, friendsCount = :friendsCount, publicShelves = :publicShelves, bio = :bio, avatarUrl = :avatarUrl',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':displayName': user.displayName || user.username || user.email.split('@')[0],
          ':isPrivate': user.isPrivate || false,
          ':friendsCount': user.friendsCount || 0,
          ':publicShelves': user.publicShelves || [],
          ':bio': user.bio || '',
          ':avatarUrl': user.avatarUrl || null
        }
      });

      await docClient.send(updateCommand);
      console.log(`  ✓ Updated ${user.email} successfully`);
      updatedCount++;
    } catch (error) {
      console.error(`  ✗ Error updating ${user.email}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');
  console.log(`Total users: ${users.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (already migrated): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('========================================\n');

  if (errorCount > 0) {
    console.log('⚠ Some users failed to migrate. Please check the errors above.');
  } else {
    console.log('✓ Migration completed successfully!');
  }
}

// Run the migration
migrateUsers().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
