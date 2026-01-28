# AWS Console Guide: Adding Friends API Endpoints

This guide walks you through adding the Friends feature endpoints to your existing API Gateway via AWS Console.

**Time Required:** 5-10 minutes
**Your API Gateway ID:** `ylpqf7y8ed`

---

## Step 1: Open API Gateway Console

1. Go to **AWS Console** → Search for "API Gateway" in the top search bar
2. Click on **API Gateway** service
3. You should see your API: **pagebound-api** (ID: `ylpqf7y8ed`)
4. Click on **pagebound-api** to open it

---

## Step 2: Create the /friends Resource

1. In the left panel, you'll see **Resources**
2. Click on the **root resource** `/`
3. Click the **Actions** dropdown → **Create Resource**
4. Fill in:
   - **Resource Name:** `friends`
   - **Resource Path:** `friends` (auto-filled)
   - ✅ Check **Enable API Gateway CORS**
5. Click **Create Resource**

---

## Step 3: Create /{userId} Under /friends

1. Select the **/friends** resource you just created (click on it)
2. Click **Actions** → **Create Resource**
3. Fill in:
   - **Resource Name:** `userId`
   - **Resource Path:** `{userId}` (with curly braces!)
   - ✅ Check **Enable API Gateway CORS**
4. Click **Create Resource**

---

## Step 4: Create Nested Resources

Now create these resources under **/friends/{userId}**:

### A. Create /list
1. Select **/friends/{userId}**
2. **Actions** → **Create Resource**
3. Resource Name: `list`
4. ✅ Enable CORS
5. Click **Create Resource**

### B. Create /requests
1. Select **/friends/{userId}**
2. **Actions** → **Create Resource**
3. Resource Name: `requests`
4. ✅ Enable CORS
5. Click **Create Resource**

### C. Create /{fromUserId} under /requests
1. Select **/friends/{userId}/requests**
2. **Actions** → **Create Resource**
3. Resource Name: `fromUserId`
4. Resource Path: `{fromUserId}`
5. ✅ Enable CORS
6. Click **Create Resource**

### D. Create /remove
1. Select **/friends/{userId}**
2. **Actions** → **Create Resource**
3. Resource Name: `remove`
4. ✅ Enable CORS
5. Click **Create Resource**

### E. Create /{friendUserId} under /remove
1. Select **/friends/{userId}/remove**
2. **Actions** → **Create Resource**
3. Resource Name: `friendUserId`
4. Resource Path: `{friendUserId}`
5. ✅ Enable CORS
6. Click **Create Resource**

### F. Create /search
1. Select **/friends/{userId}**
2. **Actions** → **Create Resource**
3. Resource Name: `search`
4. ✅ Enable CORS
5. Click **Create Resource**

### G. Create /invite
1. Select **/friends/{userId}**
2. **Actions** → **Create Resource**
3. Resource Name: `invite`
4. ✅ Enable CORS
5. Click **Create Resource**

### H. Create /{inviteCode} under /invite
1. Select **/friends/{userId}/invite**
2. **Actions** → **Create Resource**
3. Resource Name: `inviteCode`
4. Resource Path: `{inviteCode}`
5. ✅ Enable CORS
6. Click **Create Resource**

---

## Step 5: Add Methods to Resources

Now add HTTP methods to each resource. For each method:

### **GET /friends/{userId}/list**
1. Select **/friends/{userId}/list**
2. **Actions** → **Create Method** → Select **GET** → Click checkmark ✓
3. Integration type: **Lambda Function**
4. ✅ Use Lambda Proxy integration
5. Lambda Function: `pagebound-friends-api` (start typing and it will autocomplete)
6. Click **Save**
7. Click **OK** on the permission popup

### **GET /friends/{userId}/requests**
1. Select **/friends/{userId}/requests**
2. **Actions** → **Create Method** → **GET**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **POST /friends/{userId}/requests**
1. Select **/friends/{userId}/requests**
2. **Actions** → **Create Method** → **POST**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **PUT /friends/{userId}/requests/{fromUserId}**
1. Select **/friends/{userId}/requests/{fromUserId}**
2. **Actions** → **Create Method** → **PUT**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **DELETE /friends/{userId}/remove/{friendUserId}**
1. Select **/friends/{userId}/remove/{friendUserId}**
2. **Actions** → **Create Method** → **DELETE**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **GET /friends/{userId}/search**
1. Select **/friends/{userId}/search**
2. **Actions** → **Create Method** → **GET**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **POST /friends/{userId}/invite**
1. Select **/friends/{userId}/invite**
2. **Actions** → **Create Method** → **POST**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

### **GET /friends/{userId}/invite/{inviteCode}**
1. Select **/friends/{userId}/invite/{inviteCode}**
2. **Actions** → **Create Method** → **GET**
3. Lambda Proxy integration ✅
4. Lambda: `pagebound-friends-api`
5. **Save** → **OK**

---

## Step 6: Deploy API

**CRITICAL:** Changes won't take effect until you deploy!

1. Click **Actions** → **Deploy API**
2. Deployment stage: **prod** (select from dropdown)
3. Deployment description: "Added Friends endpoints"
4. Click **Deploy**

You should see: **"Successfully deployed to prod"**

---

## Step 7: Verify Deployment

### A. Get Your API Endpoint
At the top of the page, you'll see:
```
Invoke URL: https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod
```

This is your API endpoint!

### B. Test an Endpoint
Open a new browser tab and visit:
```
https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod/friends/test/list
```

You should see a JSON response (might be an error about invalid userId, but that's fine - it means the endpoint is working!)

---

## Step 8: Update Your Frontend .env

Update your `.env` file to make sure it has the correct endpoint:

```env
REACT_APP_API_ENDPOINT=https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod
```

---

## Visual Checklist

Your API Gateway should now look like this:

```
/
├── users (existing)
│   └── {email} (existing)
└── friends (NEW)
    └── {userId}
        ├── list
        │   └── GET
        ├── requests
        │   ├── GET
        │   ├── POST
        │   └── {fromUserId}
        │       └── PUT
        ├── remove
        │   └── {friendUserId}
        │       └── DELETE
        ├── search
        │   └── GET
        └── invite
            ├── POST
            └── {inviteCode}
                └── GET
```

---

## Common Issues

### "Lambda function not found"
- Make sure you're typing `pagebound-friends-api` exactly
- Check that the Lambda function exists in the same region (us-east-2)

### "Permission denied"
- Click **OK** when the permission popup appears
- API Gateway needs permission to invoke your Lambda

### "404 Not Found after deploy"
- Make sure you clicked **Deploy API** after adding methods
- Refresh your browser

### "CORS errors in browser"
- Make sure you checked ✅ **Enable API Gateway CORS** when creating resources
- If you forgot, select each resource → **Actions** → **Enable CORS** → **Enable**

---

## Verification Commands

Once done, run these to verify:

```bash
# Test friend list endpoint
curl https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod/friends/test-user-id/list

# Test search endpoint
curl "https://ylpqf7y8ed.execute-api.us-east-2.amazonaws.com/prod/friends/test-user-id/search?q=test"
```

---

## Next Steps

After completing this guide:

1. ✅ API Gateway endpoints added
2. ✅ Lambda function connected
3. ✅ Ready to test the frontend!

Run your React app:
```bash
npm start
```

Then:
1. Sign up/login
2. Click the **Friends** tab in the bottom nav
3. Try searching for users!

---

## Need Help?

If you get stuck:
1. Check the **Stages** → **prod** → **Logs/Tracing** tab for errors
2. Check Lambda function logs in **CloudWatch**
3. Verify all resources have CORS enabled
4. Make sure you deployed to the **prod** stage

The console makes this process visual and easy to verify each step! 🚀
