# IPFS Pinning Service

## Goal

The goal of this protocol is to provide a standardized way to upload, list, and delete pinned files over IPFS pinning services. Each provider will follow the standard https://ipfs.github.io/pinning-services-api-spec/.

## Evaluation

Providers will be evaluated based on:

✅ Upload Speed: Time taken to upload and pin a file.
✅ Reliability: Consistency in file availability and pinning status.
✅ Download speed: Measured at the service providers' gateway as well as a random none cached 3rd party gateway.    

For reference implementation see lighthouse storage  https://docs.lighthouse.storage/lighthouse-1/how-to/upload-data/file 

## Actions

### `uploadFile()`

- **Params**:
  - `file` (file): The file to be uploaded and pinned. Can be raw text, binary, or any other file type as defined by the mimetype.
  - `mimetype` (string): file type of uploaded bytes.
  
- **Returns**:
  - **`cid`** (string): The content identifier (CID) of the pinned file.
  - **`size`**  (int): Size in bytes of the uploaded file 

### `listPinnedFiles()`

- **Params**:
  - `status` (string, optional): Filter by pin status (e.g., "pinned", "pinning", "failed").
  
- **Returns**:
  - **`pinned_files`** (array): A list of pinned files with their CIDs and statuses.

### `deletePinnedFile()`

- **Params**:
  - `cid` (string): The content identifier (CID) of the file to be unpinned.
  
- **Returns**:
  - **`status`** (string): The status of the unpinning operation.

## Performance Requirements

- **Response Times**:
  - `uploadFile()`: Must return the CID within 30 seconds.
  - `listPinnedFiles()`: Must return the list within 10 seconds.
  - `deletePinnedFile()`: Must return the status within 10 seconds.
  
- **Rate Limits**:
  - Minimum of 2 requests per minute.
  - At least 200 API calls per subscription per month.

## Constraints

- **File Size**:
  - Maximum file size for upload is 100MB.
- **Pinning Status**:
  - Files must be correctly pinned and available through the IPFS network.
- **Compliance**:
  - Providers must adhere to the IPFS pinning service API specification.

## Example

### Upload File

#### Input

- **file**: A binary file to be uploaded.

#### Output

```json
  data: {
    "Name": 'shikamaru',
    "Hash": 'QmY77L7JzF8E7Rio4XboEpXL2kTZnW2oBFdzm6c53g5ay8',
    "Size": '91'
  }
```

### List Pinned Files

#### Input

- **status**: "pinned"

#### Output

```json
{
  "pinned_files": [
    {
      "cid": "QmTzQ1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5",
      "status": "pinned"
    },
    {
      "cid": "QmXyZ2A2B2C2D2E2F2G2H2I2J2K2L2M2N2O2P2Q2R2S2T2",
      "status": "pinned"
    }
  ]
}
```

### Delete Pinned File

#### Input

- **cid**: "QmTzQ1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5Q1N1z5"

#### Output

```json
{
  "status": "unpinned"
}
```
