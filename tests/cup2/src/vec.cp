#gen("T")
comp vec (
    ptr<T> buf,
    int len,
    int cap,
);

#gen("T")
def vec<T> {
    vec<T> new(int cap) {
        ret vec<T>(
            buf = mem:alloc(mem:size<T>() * cap),
            len = 0,
            cap = cap,
        );
    };

    #self
    sub push(T item) {
        this.buf[this.len] = item;
        this.len += 1;

        if this.len == this.cap {
            this.cap *= 2;
            this.buf = mem:realloc(this.buf, mem:size<T>() * this.cap);
        };
    };

    #self
    sub join(ptr<T> other) {
        int old_len = this.len;
        this.len += str:len(other);
        while this.len >= this.cap {
            this.cap *= 2;
            this.buf = mem:realloc(this.buf, mem:size<T>() * this.cap);
        };
        str:copy(this.buf + old_len, other);
    };

    #self
    sub join_vec(vec<T> other) {
        if other.len == 0 {
            ret;
        };
        int old_len = this.len;
        this.len += other.len;
        while this.len >= this.cap {
            this.cap *= 2;
            this.buf = mem:realloc(this.buf, mem:size<T>() * this.cap);
        };
        mem:copy(this.buf + old_len, other.buf, other.len * mem:size<T>());
    };

    #self
    sub join_back(vec<T> other) {
        if other.len == 0 {
            ret;
        };
        int old_len = this.len;
        this.len += other.len;
        while this.len >= this.cap {
            this.cap *= 2;
            this.buf = mem:realloc(this.buf, mem:size<T>() * this.cap);
        };
        mem:copy(this.buf + other.len, this.buf, mem:size<T>() * old_len);
        mem:copy(this.buf, other.buf, mem:size<T>() * other.len);
    };

    #self
    sub empty() {
        this.buf[0] = this.len = 0;
    };
};

sub push_char(ptr<vec<u8>> v, u8 c) {
    v@.buf[v@.len] = c;
    v@.len += 1;

    if v@.len == v@.cap {
        v@.cap *= 2;
        v@.buf = mem:realloc(v@.buf, mem:size<u8>() * v@.cap);
    };

    v@.buf[v@.len] = 0;
};