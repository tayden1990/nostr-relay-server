# Nostr Relay Server

This repository contains a Nostr relay server implementation designed to facilitate communication between clients using the Nostr protocol. The server is built with TypeScript and provides various features to enhance message delivery, file handling, and overall performance.

## Features

- **WebSocket and HTTP Support**: The server supports both WebSocket and HTTP protocols for client communication.
- **Event Processing**: Implements multiple NIP (Nostr Improvement Proposals) for handling events according to the Nostr protocol.
- **Authentication**: Secure WebSocket connections with authentication mechanisms.
- **Rate Limiting**: Policies to prevent abuse by limiting the rate of incoming requests.
- **File Storage**: Supports file uploads with size limits and retention policies, utilizing both local and S3 storage options.
- **Real-time Delivery**: Uses Redis for real-time event delivery and caching.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- PostgreSQL
- Redis

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/nostr-relay-server.git
   cd nostr-relay-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the database:
   - Create a PostgreSQL database and user.
   - Run the migration scripts located in `src/storage/postgres/migrations/`.

4. Configure the server:
   - Update the configuration files in the `src/config` directory as needed.

### Running the Server

To start the server, run:
```
npm start
```

### Testing

To run the tests, use:
```
npm test
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.