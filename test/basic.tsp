
scalar UID extends int64;

model User {
    @pattern("[a-z]+")
    name: string;
    uid: UID;
    posts: Post[];
}

model Post {
    title: string;
    body: {title: string, contents: string};
    uid: UID;
    pid: int64;
}

alias Both = User | Post;

model Thing {
    that: Both;
    tup: [User, float64];
}
