# Supabase browser SDK

`supabase-2.119.0.js` is the unmodified UMD distribution of `@supabase/supabase-js` 2.119.0:
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js

License: MIT, included in `supabase-LICENSE.txt`.

Served locally so the PWA shell can load without a CDN connection. To upgrade,
replace the SDK and license from the pinned official npm distribution, update
`index.html` and the `sw.js` shell list, and bump the service-worker cache version.
