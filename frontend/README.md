# Connect frontend

React and Vite frontend written in JavaScript and JSX.

## Development

In development, the Vite server proxies `/api` and Socket.IO traffic to the
deployed backend at `https://chat.bookmytrim.in`, so the browser can use the API
without cross-origin requests. To use another backend, set
`VITE_DEV_API_PROXY` in `.env.local` (for example,
`VITE_DEV_API_PROXY=http://localhost:4000`).

For a separately hosted backend, set `VITE_API_URL` to its public URL. Leave it
unset for the deployed same-origin setup, then run:

```sh
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm run lint` to check the source.
