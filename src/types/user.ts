export interface UserItem {
    id: String,
    username: String,
    walletAddress: String | null,
    status: String,
    createdAt: String,
    firstname: String,
    lastname: String,
    profilepicture: String
}

export interface UserItemResponse {
    message: string;
    data: {
        users: UserItem[];
        totalUsers: number;
        totalPages: number;
        currentPage: number;
    }
}