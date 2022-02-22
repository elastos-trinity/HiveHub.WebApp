import {
    Claims, DefaultDIDAdapter, DIDBackend,
    DIDDocument,
    JWTParserBuilder,
    VerifiableCredential,
    VerifiablePresentation, DID
} from "@elastosfoundation/did-js-sdk";
import {AppContext, HiveException} from "@dchagastelles/elastos-hive-js-sdk";
import {AppDID} from "./did/appdid";
import {UserDID} from "./did/userdid";
import {DID as ConDID} from "@elastosfoundation/elastos-connectivity-sdk-js";
import ClientConfig from "./config/clientconfig";
import {NoLoginError} from "./error";

export default class SdkContext {
    public static INSTANCE: SdkContext;
    public static readonly DID_NET = "mainnet";
    public static readonly RESOLVE_CACHE = "data/didCache";
    public static readonly USER_DIR = '/data/userDir';
    private static readonly isTest: boolean = true;

    // for test.
    private isInit: boolean = false;
    private clientConfig: any = ClientConfig.CUSTOM;
    private userDid: UserDID;
    private callerDid: UserDID;
    private appInstanceDid: AppDID;

    private context: AppContext;
    private callerContext: AppContext;
    private appIdCredential: VerifiableCredential;
    private curLoginUserDidStr: string;

    static async getInstance(): Promise<SdkContext> {
        if (!SdkContext.INSTANCE) {
            SdkContext.INSTANCE = new SdkContext();
        }
        if (SdkContext.isTest)
            await SdkContext.INSTANCE.initByTestDid();
        else
            await SdkContext.INSTANCE.initByLoginDid();
        return SdkContext.INSTANCE;
    }

    private constructor() {
        DIDBackend.initialize(new DefaultDIDAdapter(SdkContext.DID_NET));
        AppContext.setupResolver(SdkContext.DID_NET, SdkContext.RESOLVE_CACHE);
    }

    /**
     * for test.
     */
    async initByTestDid(): Promise<void> {
        if (this.isInit) {
            return;
        }

        let applicationConfig = this.clientConfig.application;
        this.appInstanceDid = await AppDID.create(applicationConfig.name,
            applicationConfig.mnemonics2,
            applicationConfig.passPhrase,
            applicationConfig.storepass,
            applicationConfig.did);

        let userConfig = this.clientConfig.user;
        this.userDid = await UserDID.create(userConfig.name,
            userConfig.mnemonic,
            userConfig.passPhrase,
            userConfig.storepass,
            userConfig.did);

        // TestData.LOG.trace("UserDid created");
        let userConfigCaller = this.clientConfig.cross.user;
        this.callerDid = await UserDID.create(userConfigCaller.name,
            userConfigCaller.mnemonic,
            userConfigCaller.passPhrase,
            userConfigCaller.storepass,
            userConfigCaller.did);

        //Application Context
        let owner = this;
        this.context = await AppContext.build({
            getLocalDataDir() : string {
                return owner.getLocalStorePath();
            },

            async getAppInstanceDocument() : Promise<DIDDocument>  {
                try {
                    return await owner.getAppInstanceDIDDoc();
                } catch (e) {
                    console.error(`failed to get app instance doc: ${e}`);
                }
                return null;
            },

            async getAuthorization(jwtToken : string) : Promise<string> {
                try {
                    let claims : Claims = (await new JWTParserBuilder().build().parse(jwtToken)).getBody();
                    if (claims == null) {
                        throw new HiveException("Invalid jwt token as authorization.");
                    }

                    let presentation = await owner.appInstanceDid.createPresentation(
                        await owner.userDid.issueDiplomaFor(owner.appInstanceDid),
                        claims.getIssuer(), claims.get("nonce") as string);

                    // TestData.LOG.debug("TestData->presentation: " + presentation.toString(true));
                    return await owner.appInstanceDid.createToken(presentation,  claims.getIssuer());
                } catch (e) {
                    // TestData.LOG.info("TestData->getAuthorization error: " + e);
                    console.log("TestData->getAuthorization error: " + e + ', ' + e.stack);
                    // TestData.LOG.error(e.stack);
                }
            }
        }, owner.userDid.getDid().toString());

        this.callerContext = await AppContext.build({
            //@Override
            getLocalDataDir(): string {
                return owner.getLocalStorePath();
            },

            async getAppInstanceDocument() : Promise<DIDDocument>  {
                try {
                    return await owner.appInstanceDid.getDocument();
                } catch (e) {
                    // TestData.LOG.error(e.stack);
                }
                return null;
            },

            async getAuthorization(jwtToken : string) : Promise<string>  {
                try {
                    return owner.getAuthAuthorization(jwtToken);
                } catch (e) {
                    throw new HiveException(e.getMessage(), e);
                }
            }
        }, this.callerDid.getDid().toString());
    }

    getProviderAddress(): string {
        return this.clientConfig.node.provider;
    }

    async getAppInstanceDIDDoc(): Promise<DIDDocument> {
        return await this.appInstanceDid.getDocument();
    }

    /**
     * for real
     * @private
     */
    private async initByLoginDid(): Promise<void> {
        const userDidStr = SdkContext.getLoginUserDid();
        if (!userDidStr) {
            throw new NoLoginError('Can not initialize SdkContext.');
        } else if (userDidStr === this.curLoginUserDidStr) {
            return;
        }

        // Application Context
        let owner = this;
        this.context = await AppContext.build({
            getLocalDataDir() : string {
                return owner.getLocalStorePath();
            },

            async getAppInstanceDocument() : Promise<DIDDocument>  {
                try {
                    console.log(`enter getAppInstanceDocument() of the app context.`);
                    return await owner.getLoginAppInstanceDidDoc();
                } catch (e) {
                    console.error(`Failed to get application instance did documentation.`);
                    return null;
                }
            },

            async getAuthorization(jwtToken : string) : Promise<string> {
                try {
                    return await owner.getAuthAuthorization(jwtToken);
                } catch (e) {
                    console.error(`TestData->getAuthorization error: ${e}`);
                    return null;
                }
            }
        }, userDidStr);
        this.curLoginUserDidStr = userDidStr;
    }

    getAppContext(): AppContext {
        return this.context;
    }

    public getLocalStorePath(): string {
        return `${SdkContext.USER_DIR}/data/store/${this.clientConfig.node.storePath}`;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // For login user ConDID.

    async getLoginAppInstanceDidDoc(): Promise<DIDDocument> {
        const didAccess = new ConDID.DIDAccess();
        console.log('after didAccess creating.');
        console.log('after didAccess creating 2.');
        const info = await didAccess.getOrCreateAppInstanceDID();
        console.log(`get the app instance did: ${info}`);
        return await info.didStore.loadDid(info.did.toString());
    }

    private async getAuthAuthorization(challenge: string): Promise<string> {
        let claims : Claims = (await new JWTParserBuilder().build().parse(challenge)).getBody();
        if (claims == null) {
            throw new HiveException("Invalid jwt token as authorization.");
        }
        if (!claims.getIssuer() || !(claims.get("nonce") as string)) {
            throw new HiveException('The received authentication JWT token does not contain iss or nonce');
        }
        let nonce = claims.get("nonce") as string;
        let hiveDid = claims.getIssuer();
        this.appIdCredential = await this.checkAppIdCredentialStatus(this.appIdCredential);
        if (!this.appIdCredential) {
            throw new HiveException('Can not get the credential for the application instance.');
        }
        let vp: VerifiablePresentation = await AppDID.createVerifiablePresentation(
            this.appIdCredential, hiveDid, nonce, this.appInstanceDid.getStorePassword());
        return await AppDID.createChallengeResponse(vp, hiveDid, this.appInstanceDid.getStorePassword());
    }

    private checkAppIdCredentialStatus(appIdCredential): Promise<VerifiableCredential> {
        return new Promise(async (resolve, reject) => {
            if (this.checkCredentialValid(appIdCredential)) {
                console.log(`Credential valid, credential is ${this.appIdCredential}`);
                resolve(appIdCredential);
                return;
            }

            console.warn('Credential invalid, Getting app identity credential');

            let didAccess = new ConDID.DIDAccess();
            try {
                let credential = await didAccess.getExistingAppIdentityCredential();
                if (credential) {
                    console.log(`Get app identity credential ${credential}`);
                    resolve(credential);
                    return;
                }

                credential = await didAccess.generateAppIdCredential();
                if (credential) {
                    console.log(`Generate app identity credential, credential is ${credential}`);
                    resolve(credential);
                    return;
                }

                let error = 'Get app identity credential error, credential is ' + JSON.stringify(credential);
                console.error(error);
                reject(error);
            } catch (error) {
                console.error(`Failed to check the application credential: ${error}`);
                reject(error);
            }
        });
    }

    private checkCredentialValid(appIdCredential): boolean {
        return appIdCredential && appIdCredential.getExpirationDate().valueOf() >= new Date().valueOf();
    }

    public async getLoginUserNodeUrl(): Promise<string> {
        const userDidStr = SdkContext.getLoginUserDid();
        if (!userDidStr) {
            throw new NoLoginError('Can not get user did hive node url.');
        }
        const userDidDocument = await DID.from(userDidStr).resolve();
        const service = userDidDocument.getService(`${userDidStr}#hivevault`);
        const url: string = service.getServiceEndpoint();
        if (url.includes(':')) {
            return service.getServiceEndpoint();
        } else if (url.startsWith('https')) {
            return url + ":443";
        }
        return url + ":80";
    }

    public async updateLoginUserNodeUrl(url: string): Promise<void> {
        // TODO:
        console.warn(`TODO: publish the node url (${url}) for login user.`);
    }

    public static getLoginUserDid(): string {
        const did = localStorage.getItem('did');
        if (!did) {
            return null;
        }
        return `did:elastos:${did}`;
    }

    public static isLogined(): boolean {
        return !!SdkContext.getLoginUserDid();
    }
}
