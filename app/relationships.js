let _ = require('lodash');

class RelationshipBuilder {
    constructor(logger, database) {
        this.logger = logger;
        this.database = database;
        let settings = require('./settings.json').relationships;
        this.tokens = settings.tokens;
        this.logger.verbose('Messaging Tokens Loaded');
    }

    linkToken(token, message, field) {
        // try find the token
        let regex = new RegExp(token.regex.replace("\\\\", "\\"));

        let results = regex.exec(field);
        if (results) {
            let result = results[1];
            // if the token is found, then find or create node for it
            try {
                message[token.name] = result.replace('/', '\/');
                this.logger.verbose("Created Token Relationship", token.name, result);
                return true;
            }
            catch (e) {
                this.logger.error(e);
            }
        }
        else {
            this.logger.silly('Regex not found in string', token.regex, field);
        }
    }

    async buildReMessageLink(message) {
        if (message.remessageto) {
            //find author record:
            let msg = await this.database.select().from('user').where({
                message_id: message.remessageto.id_str,
                service: message.service
            }).one();
            //if there is an author record, then link
            if (msg) {
                try {
                    var res = await this.database.create('EDGE', 'remessage').from(message['@rid']).to(msg['@rid']).set({
                        createdAt: new Date()
                    }).one();
                    // let res = await Author.query("CREATE EDGE author FROM " + user.id + " TO " + message.id + " SET createdAt = date(\"" + new Date().toISOString() + "\", \"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'\", \"UTC\")");
                    this.logger.verbose("Remessage (retweet) Linked", message['@rid'] + '', msg['@rid'] + '');
                    return true;
                }
                catch (e) {
                    this.logger.error(e);
                }
            }
            else {
                this.logger.verbose('No Message record for building re-message ' + message.remessageto.id_str);
            }
        }
    }

    async buildReplyLink(message) {
        //find author record:
        if (message.replyto) {
            let msg = await this.database.select().from('message').where({
                message_id: message.replyto,
                service: message.service
            }).one();
            //if there is an message record, then link
            if (msg) {
                try {
                    var res = await this.database.create('EDGE', 'reply').from(message['@rid']).to(msg['@rid']).set({
                        createdAt: new Date()
                    }).one();
                    this.logger.verbose("Reply Linked ", message['@rid'] + '', msg['@rid'] + '');
                    return true;
                }
                catch (e) {
                    this.logger.error(e);
                }
            }
            else {
                this.logger.verbose('No message record for building reply to' + message.replyto);
            }
        }
        // });
    }

    async buildAuthorLink(message) {
        //find author record:

        let user = null;
        if (message.user_from) {
            try {
                user = await this.database.update('user')
                    .set({
                        account_number: message.user_from.id_str,
                        service: message.service,
                        account: message.user_from.screen_name,
                        profile: message.user_from.profile_image_url_https,
                        name: message.user_from.name,
                        _raw: message.user_from
                    })
                    .upsert()
                    .where(
                    {
                        account_number: message.user_from.id_str,
                        service: message.service
                    })
                    .return('AFTER')
                    .one();
            }
            catch (e) {
                this.logger.error(e);
            }

            //if there is an author record, then link
            if (user) {
                try {
                    var res = await this.database.create('EDGE', 'author').from(user['@rid']).to(message['@rid']).set({
                        createdAt: new Date()
                    }).one();
                    this.logger.verbose("Author Linked ", user['@rid'] + '', message['@rid'] + '');
                    return true;
                }
                catch (e) {
                    this.logger.error(e);
                }
            }
            else {
                this.logger.error('User not found or created as author');
            }
        }
        else {
            this.logger.error('user_from field not present', message['@rid']);
        }
    }

    async processMessage(message) {
        //for each rule in settings
        this.logger.verbose("Process Message", message['@rid'] + '');

        //link author:
        await this.buildAuthorLink(message);

        //link retweet
        await this.buildReMessageLink(message);

        //link reply
        await this.buildReplyLink(message);

        //build relationship with rule:
        let processedtokens = [];
        let newfields = {};
        for (let token of this.tokens) {
            // for the body of the message
            if (!_.includes(processedtokens, JSON.stringify(token)) && this.linkToken(token, newfields, message.text))
                processedtokens.push(JSON.stringify(token));

            if (message.entities) {
                //Twitter URLs
                if (message.entities.urls) {
                    for (let entity of message.entities.urls) {
                        if (!_.includes(processedtokens, JSON.stringify(token)) && this.linkToken(token, newfields, entity.expanded_url)) {
                            processedtokens.push(JSON.stringify(token));
                        }
                    }
                }

                if (message.entities.hashtags) {
                    for (let entity of message.entities.urls) {
                        if (!_.includes(processedtokens, JSON.stringify(token)) && this.linkToken(token, newfields, '#' + entity.text))
                            processedtokens.push(JSON.stringify(token));
                    }
                }
            }
        }

        //save updated object
        newfields.processed = true;
        try {
            await this.database.update(message['@rid']).set(newfields).one();
        } catch (e) {
            console.log(e);
        }
    }

    async init() {
        this.logger.info('Relationship Builder Started');

        let unprocessed = await this.database.select().from('message').where({ processed: undefined }).all();
        this.logger.verbose('Processing ' + _.size(unprocessed) + ' records');
        for (let msg of unprocessed) {
            await this.processMessage(msg);
        }
    }
}

module.exports = RelationshipBuilder;