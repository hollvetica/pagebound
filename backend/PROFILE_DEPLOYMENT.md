# Profile Feature Deployment Guide

This guide covers deploying the profile enhancement features including avatar uploads, tagline, favorite books, and reading stats.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- Access to AWS Console with permissions for S3, DynamoDB, Lambda, and API Gateway

## Step 1: Create S3 Bucket for Profile Images

### Using AWS CLI:

```bash
# Create the S3 bucket
aws s3 mb s3://pagebound-profile-images --region us-east-2

# Configure bucket for private access with CORS
aws s3api put-bucket-cors --bucket pagebound-profile-images --cors-configuration file://s3-cors-config.json --region us-east-2

# Enable server-side encryption
aws s3api put-bucket-encryption --bucket pagebound-profile-images \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' --region us-east-2

# Block public access (images will be served via presigned URLs or authenticated requests)
aws s3api put-public-access-block --bucket pagebound-profile-images \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region us-east-2
```

### Using AWS Console:

1. Go to S3 service in AWS Console
2. Click "Create bucket"
3. **Bucket name**: `pagebound-profile-images`
4. **Region**: `us-east-2` (US East Ohio)
5. **Object Ownership**: ACLs disabled (recommended)
6. **Block Public Access**: Keep all options checked
7. **Bucket Versioning**: Disabled
8. **Server-side encryption**: Enable with Amazon S3-managed keys (SSE-S3)
9. **Object Lock**: Disabled
10. Click "Create bucket"
11. After creation, go to Permissions tab → CORS configuration and add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

## Step 2: Create DynamoDB Library Table

### Using AWS CLI:

```bash
aws dynamodb create-table \
  --cli-input-json file://create-library-table.json \
  --region us-east-2
```

### Using AWS Console:

1. Go to DynamoDB service in AWS Console
2. Click "Create table"
3. **Table name**: `pagebound-library`
4. **Partition key**: `userId` (String)
5. **Sort key**: `isbn` (String)
6. **Table settings**: Customize settings
7. **Read/write capacity**: On-demand
8. Click "Create table"
9. After creation, create Global Secondary Index:
   - **Index name**: `userId-shelf-index`
   - **Partition key**: `userId` (String)
   - **Sort key**: `shelf` (String)
   - **Projected attributes**: All

## Step 3: Update Lambda Functions

### Update Existing userAPI Lambda:

1. Navigate to Lambda service in AWS Console
2. Find the `pagebound-user-api` function
3. Update the code with the new version from `backend/lambda/userAPI.js`
4. Add environment variables:
   - `PROFILE_IMAGES_BUCKET` = `pagebound-profile-images`
   - `LIBRARY_TABLE` = `pagebound-library`
5. Update the Lambda execution role to include S3 permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:DeleteObject"
  ],
  "Resource": "arn:aws:s3:::pagebound-profile-images/*"
}
```

6. Add DynamoDB permissions for the library table:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query",
    "dynamodb:GetItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-2:*:table/pagebound-library",
    "arn:aws:dynamodb:us-east-2:*:table/pagebound-library/index/*"
  ]
}
```

7. Deploy the updated function

### Create New libraryAPI Lambda:

1. Navigate to Lambda service in AWS Console
2. Click "Create function"
3. **Function name**: `pagebound-library-api`
4. **Runtime**: Node.js 18.x (or latest)
5. **Architecture**: x86_64
6. **Permissions**: Create a new role with basic Lambda permissions
7. Click "Create function"
8. Update the code with `backend/lambda/libraryAPI.js`
9. Add environment variable:
   - `LIBRARY_TABLE` = `pagebound-library`
10. Update the execution role to include DynamoDB permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:GetItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-2:*:table/pagebound-library",
    "arn:aws:dynamodb:us-east-2:*:table/pagebound-library/index/*"
  ]
}
```

11. Deploy the function

## Step 4: Update API Gateway

### Add New Endpoints to userAPI:

1. Navigate to API Gateway in AWS Console
2. Find your API (e.g., `pagebound-api`)
3. Under the `/users/{email}` resource, add new methods:
   - `POST /users/{email}/avatar-upload-url` → userAPI Lambda
   - `POST /users/{email}/avatar-confirm` → userAPI Lambda
   - `PUT /users/{email}/profile` → userAPI Lambda
   - `GET /users/{email}/stats` → userAPI Lambda

### Create New Library Resource:

1. Create a new resource `/library`
2. Create a path parameter resource `{userId}`
3. Under `/library/{userId}`, create resource `/books`
4. Add methods:
   - `GET /library/{userId}/books` → libraryAPI Lambda
   - `POST /library/{userId}/books` → libraryAPI Lambda
5. Under `/library/{userId}/books`, create resource `{isbn}`
6. Add methods:
   - `PUT /library/{userId}/books/{isbn}` → libraryAPI Lambda
   - `DELETE /library/{userId}/books/{isbn}` → libraryAPI Lambda
7. Create resource `/library/{userId}/stats`
8. Add method:
   - `GET /library/{userId}/stats` → libraryAPI Lambda

### Enable CORS:

For each new endpoint:
1. Select the method
2. Click "Actions" → "Enable CORS"
3. Enable for all methods (GET, POST, PUT, DELETE, OPTIONS)
4. Confirm

### Deploy API:

1. Click "Actions" → "Deploy API"
2. Select stage: `prod`
3. Click "Deploy"
4. Note the Invoke URL (should be: `https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod`)

## Step 5: Update Frontend Environment Variables

Update `src/amplifyConfig.js` or `.env` file to ensure:

```javascript
REACT_APP_API_ENDPOINT=https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod
```

## Step 6: Deploy Frontend

```bash
# Install dependencies if needed
npm install

# Build the React app
npm run build

# Deploy to hosting service (e.g., Amplify Hosting, S3 + CloudFront, etc.)
# Example for Amplify:
amplify publish
```

## Step 7: Data Migration (Optional)

If you have existing users, run the migration script to add default values for new profile fields:

```bash
# Navigate to backend directory
cd backend/scripts

# Install dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Run migration
node migrate-profile-fields.js
```

This will add:
- `tagline: ""`
- `favoriteBooks: []`
- `stats: {chaptersCompleted: 0, booksRead: 0, joinedDate: createdAt}`
- `updatedAt: <current timestamp>`

## Verification Steps

### 1. Test Avatar Upload

1. Log in to the app
2. Navigate to Settings
3. Click "Choose Image" and select a photo
4. Click "Save Photo"
5. Verify photo appears on Profile page
6. Check S3 bucket to confirm file was uploaded
7. Upload another photo and verify old one is deleted

### 2. Test Tagline

1. In Settings, add a tagline in the Personal Tagline section
2. Click "Save Tagline"
3. Navigate to Profile page
4. Verify tagline appears in quotes below username

### 3. Test Favorite Books

1. Add books to your library (if not already done)
2. In Settings, click "Edit Favorites"
3. Select up to 10 books
4. Click "Save Selection"
5. Navigate to Profile page
6. Verify favorite books display in grid

### 4. Test Stats

1. Add books to your library
2. Move some books to "Read" shelf
3. Set chapter counts on books
4. Navigate to Profile page
5. Verify stats show correct numbers:
   - Chapters = sum of totalChapters from "Read" shelf books
   - Books Read = count of books on "Read" shelf
   - Friends = friendsCount from database

### 5. Test Home Feed Avatars

1. Navigate to Home page
2. Verify activity feed items show circular avatars or letter placeholders
3. If you uploaded an avatar, check if it appears in future feed items

### 6. Test Library Backend Sync

1. Add a book to library
2. Open browser DevTools → Network tab
3. Verify API call to `POST /library/{userId}/books` succeeds
4. Refresh page
5. Verify book persists (loaded from backend, not just localStorage)

## Rollback Procedure

If issues occur:

1. **Frontend**: Deploy previous version from git history
2. **Lambda Functions**: Revert to previous version using Lambda's version history
3. **API Gateway**: Redeploy previous stage
4. **DynamoDB**: Library table can remain (data is additive)
5. **S3**: Bucket can remain (no impact if not used)

## Monitoring

Set up CloudWatch alarms for:

- Lambda error rates > 5%
- API Gateway 4xx/5xx errors
- S3 upload failures
- DynamoDB throttling

## Cost Estimates

With 1000 active users:
- S3 storage (1GB): ~$0.02/month
- S3 requests (10K uploads): ~$0.05/month
- Lambda invocations (50K): ~$0.10/month
- DynamoDB (library table): ~$2.50/month
- **Total**: ~$3-5/month

## Troubleshooting

### Avatar uploads fail
- Check S3 bucket permissions
- Verify Lambda has S3 write permissions
- Check CORS configuration on bucket
- Verify presigned URL expiration (300 seconds)

### Stats show 0 for books read
- Check library table exists and has data
- Verify userAPI Lambda has permission to query library table
- Check that books are on "Read" shelf
- Verify totalChapters field is populated

### Favorite books don't appear
- Check userProfile.favoriteBooks is populated in DynamoDB
- Verify data structure matches `{isbn, title, author, coverUrl}`
- Check browser console for errors

### Library doesn't sync to backend
- Verify libraryAPI Lambda is deployed
- Check API Gateway has library endpoints configured
- Verify CORS is enabled on library endpoints
- Check browser console for API errors

## Support

For issues or questions, refer to the main project documentation or create an issue in the repository.
