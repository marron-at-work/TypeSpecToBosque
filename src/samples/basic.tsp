namespace Main {

@minValue(0)
scalar UID extends int64;

model User {
    @pattern("[a-z]+")
    name: string;
    uid: UID;
    posts: Post[];

    ooboy: { @minValue(0) x: int64, @minValue(1) y: int64 }[];
}

model Post {
    title: string;
    body: {
        @minLength(1)
        title: string, 
        contents: string
    };
    uid: UID;
    pid: int64;
}

alias Both = User | Post;

model Thing {
    that: Both;
    tup: [User, float64];
}

union TResult {
    TOk: {data: int64},
    TErr: { @pattern("[a-z]+") msg: string }
}
}
