require('../lib/fakes');

module.exports = function upload(stream, idOrPath, tag, done) {
    var blob = blobManager.create(account);
    var tx = db.begin();
    function backoff(err) {
        tx.rollback();
        return done(err);
    }
    blob.put(stream, function (err, blobId) {
        if (err) return done(err);
        self.byUuidOrPath(idOrPath).get(function (err, file) {
            if (err) return done(err);
            var previousId = file ? file.version : null;
            var version = {
                userAccountId: userAccount.id,
                date: new Date(),
                blobId: blobId,
                creatorId: userAccount.id,
                previousId: previousId,
            };
            version.id = Version.createHash(version);
            Version.insert(version).execWithin(tx, function (err) {
                if (err) return backoff(err);
                if (!file) {
                    var splitPath = idOrPath.split('/');
                    var fileName = splitPath[splitPath.length - 1];
                    var newId = uuid.v1();
                    self.createQuery(idOrPath, {
                        id: newId,
                        userAccountId: userAccount.id,
                        name: fileName,
                        version: version.id
                    }, function (err, q) {
                        if (err) return backoff(err);
                        q.execWithin(tx, function (err) {
                            afterFileExists(err, newId);
                        });

                    })
                }
                else return afterFileExists(null, file.id);
            });
            function afterFileExists(err, fileId) {
                if (err) return backoff(err);
                FileVersion.insert({fileId: fileId,versionId: version.id})
                    .execWithin(tx, function (err) {
                        if (err) return backoff(err);
                        File.whereUpdate({id: fileId}, {
                            version: version.id
                        }).execWithin(tx, function (err) {
                            if (err) return backoff(err);
                            tx.commit(done);
                        });
                })
            }
        });
    });
}
