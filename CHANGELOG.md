# Changelog

## [1.0.0](https://github.com/Asterki/unah-red-de-tutorias/compare/unah-red-tutores-v0.1.0...unah-red-tutores-v1.0.0) (2026-10-31)


### ⚠ BREAKING CHANGES

* **server:** Account.password is nullable and roles move to AccountRole.
* **shared:** template roles and Item contracts are removed.
* replace schema with template v1
* split into independent packages

### Features

* add antd theme provider and brand tokens ([d0c66ed](https://github.com/Asterki/unah-red-de-tutorias/commit/d0c66edb1bc1fd43649adbcd95593aa049802e9b))
* add doctor diagnostics ([27b2429](https://github.com/Asterki/unah-red-de-tutorias/commit/27b24290d20d6da60243c313298eb749e5fab6a5))
* add en and es locale packs ([86d49de](https://github.com/Asterki/unah-red-de-tutorias/commit/86d49de52e45df97951542e1b41e13a9414724ed))
* add example module removal script ([733d4c2](https://github.com/Asterki/unah-red-de-tutorias/commit/733d4c2018fe89132d5cdab20dc68061c21fe71f))
* add headless server mode ([2acaaba](https://github.com/Asterki/unah-red-de-tutorias/commit/2acaabacc65c26aa4bb5a05c73851c0769b26521))
* add health and readiness endpoints ([0c253cc](https://github.com/Asterki/unah-red-de-tutorias/commit/0c253cc182c7318857818e3b43354e9da17ded96))
* add in-app documentation page ([028fd34](https://github.com/Asterki/unah-red-de-tutorias/commit/028fd34eb8b7215c8965caff137789047ce22ee6))
* add items example module (client) ([4c3254a](https://github.com/Asterki/unah-red-de-tutorias/commit/4c3254ac7f26f82e5432be5233807cafbaec33d2))
* add items example module (server) ([16d851a](https://github.com/Asterki/unah-red-de-tutorias/commit/16d851af32fb512d53fa68f5b613311cdbf4b24e))
* add legacy data export script ([4dd8a31](https://github.com/Asterki/unah-red-de-tutorias/commit/4dd8a3197ebb3adeb0310cacb177a8ffbe7c6a7f))
* add one-command template init ([f4e6060](https://github.com/Asterki/unah-red-de-tutorias/commit/f4e60606d84f1cab77d6b78709be049994c9d9b1))
* add vercel spa and api proxy config ([28f2324](https://github.com/Asterki/unah-red-de-tutorias/commit/28f2324b60c8df783a60c1d4a00eb5c4a2c7a11f))
* align domain schema and add federated login ([2010cb3](https://github.com/Asterki/unah-red-de-tutorias/commit/2010cb39b25d784bd05c8061bdc7addf957a95c3))
* **client:** align accounts and add federated login ([5473680](https://github.com/Asterki/unah-red-de-tutorias/commit/54736808845f98bc9b5a15177bdc3acd3ef3989e))
* define shared roles and permissions ([dcc0651](https://github.com/Asterki/unah-red-de-tutorias/commit/dcc065126813ed39139fc85d06da4b8a8bfb8a6e))
* env-driven seed and forced password change ([b3f94e0](https://github.com/Asterki/unah-red-de-tutorias/commit/b3f94e013823181466780aaa31147baabc3b1d6e))
* harden sessions and http security ([1cfe4a2](https://github.com/Asterki/unah-red-de-tutorias/commit/1cfe4a246a576c15bceaff608d9061d3b66ffb05))
* rest api with default-deny permissions ([9a8ac55](https://github.com/Asterki/unah-red-de-tutorias/commit/9a8ac5538b32abf29605e43635eab1f067dc97c5))
* serve permissioned in-app docs ([dca6858](https://github.com/Asterki/unah-red-de-tutorias/commit/dca6858f8caaab6f60b591c27c63a36a1d5cb674))
* **server:** align schema and add federated login ([1bdda84](https://github.com/Asterki/unah-red-de-tutorias/commit/1bdda8438d0656c6b27186a02fd56cebe6c7534d))
* **shared:** align roles and add federated domain rules ([4a3e2e8](https://github.com/Asterki/unah-red-de-tutorias/commit/4a3e2e80642c18626bba9d3941ce1eaea71cf29f))
* sync client with hardcoded rbac ([991b480](https://github.com/Asterki/unah-red-de-tutorias/commit/991b48043513996a00b028dac157dc4d5165ca98))


### Bug Fixes

* apply validated request data ([744b5e5](https://github.com/Asterki/unah-red-de-tutorias/commit/744b5e5ade8f4ddc0a8fe6eba035bf487c521046))
* generate prisma client in ci ([2dc2800](https://github.com/Asterki/unah-red-de-tutorias/commit/2dc2800b647558249083718c3a677cdac98d9786))
* remove npm from the runtime image ([80201f7](https://github.com/Asterki/unah-red-de-tutorias/commit/80201f7695547e051467ae24911ad6f5bceca7b3))
* run prisma cli from the server package ([191cdf1](https://github.com/Asterki/unah-red-de-tutorias/commit/191cdf1a9edac3f3348e6bdbafebf3de46e3577f))


### Refactoring

* add centralized error handling ([7d3b608](https://github.com/Asterki/unah-red-de-tutorias/commit/7d3b60890db7a5fdd44bb6ea9dc4b0ba03237d42))
* add typed zod configuration ([d3210ea](https://github.com/Asterki/unah-red-de-tutorias/commit/d3210eae903c79d0d7c211a23ab164fe0ca1ef18))
* centralize theme and align tailwind ([74706c9](https://github.com/Asterki/unah-red-de-tutorias/commit/74706c99de655ab50d64643593955c6629880991))
* make startup sequence explicit ([9ffd84d](https://github.com/Asterki/unah-red-de-tutorias/commit/9ffd84d80db92f845f0c08ba37c9f511dfbbfae7))
* rebuild account persistence with audit and policy ([5ae9c6b](https://github.com/Asterki/unah-red-de-tutorias/commit/5ae9c6ba41b65c7cbfebfbfdcab944efc6912e48))
* remove hardcoded branding and inline styles ([36a0f82](https://github.com/Asterki/unah-red-de-tutorias/commit/36a0f8226472ce4bc939bd51204341a061e08a0f))
* replace logging with pino ([9b79831](https://github.com/Asterki/unah-red-de-tutorias/commit/9b79831ac675c6e7d96358abec375b5bbaf23989))
* replace schema with template v1 ([c1c1f98](https://github.com/Asterki/unah-red-de-tutorias/commit/c1c1f9893ce56e58859d129e37862e8c26d1a66a))
* split into independent packages ([bbb61e3](https://github.com/Asterki/unah-red-de-tutorias/commit/bbb61e3c81259a298fdda8f18c9199f78747d00c))


### Documentation

* add AGENTS.md ([0ea3253](https://github.com/Asterki/unah-red-de-tutorias/commit/0ea3253fac37ee48b2bb2edf375843c0365ee95f))
* add refactor plan ([7e9804f](https://github.com/Asterki/unah-red-de-tutorias/commit/7e9804f268ae555aecd92044bccaabab617e7dcf))
* archive planning documents ([9488501](https://github.com/Asterki/unah-red-de-tutorias/commit/94885019e0b9d7abdb2429f9e5db73eae57c058c))
* correct documentation details ([8fe0364](https://github.com/Asterki/unah-red-de-tutorias/commit/8fe0364aa43eda65ff931de720a72ac237ab9ee9))
* document federated login and provider setup ([5b04059](https://github.com/Asterki/unah-red-de-tutorias/commit/5b0405915b204dbea5532607f59f700ab05fd941))
* record package layout spike results ([c3ea0a4](https://github.com/Asterki/unah-red-de-tutorias/commit/c3ea0a43e2ca92d2fc3096f87e4ea08e09e97926))
* rewrite template documentation ([0afd85f](https://github.com/Asterki/unah-red-de-tutorias/commit/0afd85fd811f6109fdbde863e071e5905d5fe492))
